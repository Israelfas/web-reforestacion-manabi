import os
import logging
from datetime import datetime, timedelta
from collections import defaultdict
from flask import Flask, render_template, request, jsonify
from supabase import create_client, Client
from dotenv import load_dotenv
from functools import wraps
import uuid

load_dotenv()

# --- CONFIGURACIÓN DE LOGS ---
log_dir = 'logs'
if not os.path.exists(log_dir):
    os.makedirs(log_dir)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(os.path.join(log_dir, 'app.log')),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# --- CONFIGURACIÓN DE SUPABASE ---
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")

if not url or not key:
    logger.critical("SUPABASE_URL y SUPABASE_KEY deben estar configuradas")
    raise ValueError("Variables de entorno faltantes")

try:
    supabase: Client = create_client(url, key)
    logger.info("Conexión con Supabase establecida.")
except Exception as e:
    logger.critical(f"Error al conectar con Supabase: {e}")
    raise

# --- CONFIGURACIÓN DE FLASK ---
app = Flask(__name__)
app.config['JSON_SORT_KEYS'] = False
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024  # 5MB límite de subida

# --- SISTEMA DE RATE LIMITING (SEGURIDAD) - SOLO EMAIL ---
# Almacenamiento en memoria para intentos fallidos
LOGIN_ATTEMPTS = defaultdict(lambda: {'count': 0, 'blocked_until': None, 'first_attempt': None})

# Configuración de seguridad
MAX_LOGIN_ATTEMPTS = 3
LOCKOUT_DURATION = timedelta(minutes=5)  # 5 minutos de bloqueo
ATTEMPT_WINDOW = timedelta(minutes=5)    # Ventana de 5 minutos para contar intentos

def get_client_ip():
    """Obtiene la IP real del cliente considerando proxies (solo para logs)"""
    if request.headers.get('X-Forwarded-For'):
        return request.headers.get('X-Forwarded-For').split(',')[0].strip()
    elif request.headers.get('X-Real-IP'):
        return request.headers.get('X-Real-IP')
    return request.remote_addr

def check_rate_limit(identifier):
    """
    Verifica si un identificador (email) está bloqueado
    Retorna (is_blocked, attempts_left, blocked_until)
    """
    now = datetime.utcnow()
    attempts_data = LOGIN_ATTEMPTS[identifier]
    
    # Si está bloqueado, verificar si ya expiró el bloqueo
    if attempts_data['blocked_until']:
        if now < attempts_data['blocked_until']:
            # Aún bloqueado
            return True, 0, attempts_data['blocked_until']
        else:
            # Expiró el bloqueo, resetear TODO
            logger.info(f"🔓 Bloqueo expirado para {identifier}, reseteando contador")
            attempts_data['count'] = 0
            attempts_data['blocked_until'] = None
            attempts_data['first_attempt'] = None
            return False, MAX_LOGIN_ATTEMPTS, None
    
    # Si la ventana de tiempo expiró, resetear contador
    if attempts_data['first_attempt'] and (now - attempts_data['first_attempt']) > ATTEMPT_WINDOW:
        logger.info(f"⏰ Ventana de tiempo expirada para {identifier}, reseteando intentos")
        attempts_data['count'] = 0
        attempts_data['first_attempt'] = None
    
    # Calcular intentos restantes
    attempts_left = MAX_LOGIN_ATTEMPTS - attempts_data['count']
    return False, attempts_left, None

def record_failed_attempt(identifier):
    """Registra un intento fallido y bloquea si es necesario"""
    now = datetime.utcnow()
    attempts_data = LOGIN_ATTEMPTS[identifier]
    
    # Si es el primer intento reciente, registrar tiempo
    if attempts_data['count'] == 0:
        attempts_data['first_attempt'] = now
        logger.info(f"🕐 Primer intento fallido para {identifier}")
    
    attempts_data['count'] += 1
    logger.info(f"📊 Intentos fallidos para {identifier}: {attempts_data['count']}/{MAX_LOGIN_ATTEMPTS}")
    
    # Si alcanzó el máximo, bloquear
    if attempts_data['count'] >= MAX_LOGIN_ATTEMPTS:
        attempts_data['blocked_until'] = now + LOCKOUT_DURATION
        logger.warning(f"🔒 Email {identifier} bloqueado hasta {attempts_data['blocked_until']} UTC")
        return True  # Indica que se acaba de bloquear
    
    return False

def reset_attempts(identifier):
    """Resetea los intentos después de un login exitoso"""
    if identifier in LOGIN_ATTEMPTS:
        LOGIN_ATTEMPTS[identifier] = {'count': 0, 'blocked_until': None, 'first_attempt': None}
        logger.info(f"✅ Intentos reseteados para {identifier}")

# --- DECORADORES Y VALIDACIONES ---
def handle_errors(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except ValueError as e:
            logger.warning(f"Error de validación en {f.__name__}: {str(e)}")
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            logger.error(f"Error inesperado en {f.__name__}: {str(e)}", exc_info=True)
            return jsonify({"error": "Error interno del servidor"}), 500
    return decorated_function

def validate_coordinates(lat, lng):
    try:
        lat_f, lng_f = float(lat), float(lng)
    except (TypeError, ValueError):
        raise ValueError("Coordenadas inválidas")
    if not (-90 <= lat_f <= 90) or not (-180 <= lng_f <= 180):
        raise ValueError("Coordenadas fuera de rango")
    return lat_f, lng_f

def sanitize_string(text, min_length=2, max_length=100, field_name="texto"):
    if not isinstance(text, str):
        raise ValueError(f"'{field_name}' debe ser texto")
    cleaned = text.strip()
    if not (min_length <= len(cleaned) <= max_length):
        raise ValueError(f"'{field_name}' debe tener {min_length}-{max_length} caracteres")
    return cleaned

def validate_password(password):
    if not password or not isinstance(password, str):
        raise ValueError("Contraseña inválida")
    if len(password) < 8:
        raise ValueError("La contraseña debe tener al menos 8 caracteres")
    return password.strip()

def validate_email(email):
    if not email or not isinstance(email, str):
        raise ValueError("Email inválido")
    email = email.strip().lower()
    if '@' not in email or '.' not in email.split('@')[-1]:
        raise ValueError("Formato de email inválido")
    if len(email) < 5 or len(email) > 100:
        raise ValueError("Email debe tener entre 5 y 100 caracteres")
    return email

# --- RUTAS PRINCIPALES ---
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/health")
@handle_errors
def health_check():
    return jsonify({"status": "ok", "timestamp": datetime.utcnow().isoformat()}), 200

# --- CRUD COMPLETO DE ÁRBOLES ---
@app.route("/api/obtener_arboles", methods=['GET'])
@handle_errors
def obtener_arboles():
    logger.info("Obteniendo árboles...")
    try:
        limit = int(request.args.get('limit', 1000))
        offset = int(request.args.get('offset', 0))
        if limit <= 0 or offset < 0:
            raise ValueError("Parámetros inválidos")
    except ValueError:
        raise ValueError("Límites deben ser números válidos")

    response = supabase.table("arboles_sembrados") \
        .select("id, especie, latitud, longitud, fecha_siembra, foto_url, user_email") \
        .limit(limit).offset(offset).order('fecha_siembra', desc=True).execute()

    logger.info(f"Obtenidos {len(response.data)} árboles")
    return jsonify(response.data), 200

@app.route("/api/plantar_arbol", methods=['POST'])
@handle_errors
def plantar_arbol():
    datos = request.json
    if not datos:
        raise ValueError("Sin datos")

    especie = sanitize_string(datos.get("especie"), field_name="especie")
    latitud, longitud = validate_coordinates(datos.get("latitud"), datos.get("longitud"))

    user_email = datos.get("user_email", "usuario@ejemplo.com")
    foto_url = datos.get("foto_url")

    nuevo_arbol = {
        "especie": especie,
        "latitud": round(latitud, 6),
        "longitud": round(longitud, 6),
        "fecha_siembra": datetime.utcnow().isoformat() + "+00:00",
        "user_email": user_email,
        "foto_url": foto_url
    }

    logger.info(f"Plantando árbol: {especie}")
    response = supabase.table("arboles_sembrados").insert(nuevo_arbol).execute()

    if hasattr(response, 'error') and response.error:
         logger.error(f"Error al insertar árbol en Supabase: {response.error.message}")
         raise Exception(f"Error de base de datos: {response.error.message}")
    if not response.data:
         logger.error("No se recibió data después de insertar el árbol.")
         raise Exception("No se pudo insertar el árbol, respuesta vacía.")

    logger.info(f"Árbol plantado ID: {response.data[0].get('id')}")
    return jsonify(response.data[0]), 201

@app.route("/api/editar_arbol/<int:arbol_id>", methods=['PUT'])
@handle_errors
def editar_arbol(arbol_id):
    datos = request.json
    if not datos:
        raise ValueError("Sin datos para actualizar")

    updates = {}
    if "especie" in datos:
        updates["especie"] = sanitize_string(datos["especie"], field_name="especie")
    if "foto_url" in datos:
        updates["foto_url"] = datos["foto_url"]

    if not updates:
        raise ValueError("No hay cambios para aplicar")

    logger.info(f"Editando árbol ID {arbol_id}: {updates}")
    response = supabase.table("arboles_sembrados") \
        .update(updates).eq("id", arbol_id).execute()

    if hasattr(response, 'error') and response.error:
         logger.error(f"Error al actualizar árbol {arbol_id} en Supabase: {response.error.message}")
         raise Exception(f"Error de base de datos: {response.error.message}")
    if not response.data:
         logger.warning(f"No se actualizó data para el árbol {arbol_id}, ¿existe?")
         raise ValueError(f"No se pudo actualizar el árbol con ID {arbol_id} (puede que no exista)")

    logger.info(f"Árbol {arbol_id} actualizado")
    return jsonify(response.data[0]), 200

@app.route("/api/eliminar_arbol/<int:arbol_id>", methods=['DELETE'])
@handle_errors
def eliminar_arbol(arbol_id):
    logger.info(f"Intentando eliminar árbol ID {arbol_id}")

    try:
        tree_response = supabase.table("arboles_sembrados") \
            .select("foto_url").eq("id", arbol_id).maybe_single().execute()

        foto_url_a_eliminar = None
        if tree_response.data and tree_response.data.get("foto_url"):
            foto_url_a_eliminar = tree_response.data["foto_url"]

    except Exception as e:
        logger.error(f"Error al obtener foto_url para árbol {arbol_id}: {e}")

    try:
        delete_response = supabase.table("arboles_sembrados") \
            .delete().eq("id", arbol_id).execute()

        if hasattr(delete_response, 'error') and delete_response.error:
            logger.error(f"Error al eliminar árbol {arbol_id} de Supabase DB: {delete_response.error.message}")
            raise Exception(f"Error de base de datos al eliminar: {delete_response.error.message}")
        if not delete_response.data:
            logger.warning(f"No se eliminó data para el árbol {arbol_id}, ¿existía?")
            raise ValueError(f"No se encontró el árbol con ID {arbol_id} para eliminar")

        logger.info(f"Registro de árbol {arbol_id} eliminado de la base de datos.")

    except Exception as e:
         logger.error(f"Error crítico al eliminar registro de árbol {arbol_id}: {e}", exc_info=True)
         return jsonify({"error": f"Error al eliminar el registro del árbol: {e}"}), 500

    if foto_url_a_eliminar:
        try:
            if "/arboles-fotos/" in foto_url_a_eliminar:
                path_parts = foto_url_a_eliminar.split("/arboles-fotos/")
                if len(path_parts) > 1:
                    filename = path_parts[-1].split("?")[0]
                    if filename:
                         logger.info(f"Intentando eliminar foto del storage: arboles-fotos/{filename}")
                         supabase.storage.from_("arboles-fotos").remove([filename])
                         logger.info(f"Solicitud de eliminación de foto {filename} enviada al storage.")
                    else:
                         logger.warning(f"No se pudo extraer filename válido de la URL: {foto_url_a_eliminar}")

        except Exception as e:
            logger.warning(f"No se pudo eliminar la foto {foto_url_a_eliminar} del storage: {e}")

    return jsonify({"message": f"Árbol {arbol_id} eliminado exitosamente", "id": arbol_id}), 200

# --- SUBIDA DE FOTOS Y AVATARES ---
@app.route("/api/upload_foto", methods=['POST'])
@handle_errors
def upload_foto():
    if 'foto' not in request.files:
        raise ValueError("No se envió ninguna foto")

    file = request.files['foto']
    if file.filename == '':
        raise ValueError("Archivo sin nombre")

    allowed_extensions = {'png', 'jpg', 'jpeg', 'webp'}
    file_ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
    if file_ext not in allowed_extensions:
        raise ValueError(f"Formato no permitido. Use: {', '.join(allowed_extensions)}")

    unique_filename = f"{uuid.uuid4()}.{file_ext}"
    logger.info(f"Subiendo foto: {unique_filename}")

    try:
        file_content = file.read()
        content_type = f"image/{file_ext}" if file_ext != 'jpg' else 'image/jpeg'

        supabase.storage.from_("arboles-fotos").upload(
            path=unique_filename,
            file=file_content,
            file_options={
                "content-type": content_type,
                "cache-control": "3600",
                "upsert": "false"
            }
        )

        public_url = supabase.storage.from_("arboles-fotos").get_public_url(unique_filename)

        logger.info(f"Foto subida exitosamente: {public_url}")
        return jsonify({
            "foto_url": public_url,
            "filename": unique_filename
        }), 201

    except Exception as e:
        logger.error(f"Error al subir foto a Supabase Storage: {str(e)}", exc_info=True)
        error_message = f"Error interno al subir la foto: {str(e)}"
        if "policy" in str(e).lower():
            error_message = "Error de permisos al subir la foto. Verifica las políticas RLS del bucket."
        elif "Invalid Input" in str(e):
             error_message = f"Datos inválidos para la subida: {str(e)}"

        raise Exception(error_message)

@app.route("/api/upload_avatar", methods=['POST'])
@handle_errors
def upload_avatar():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        raise ValueError("Token de autorización requerido")
    
    jwt_token = auth_header.split(' ')[1]
    
    try:
        user_response = supabase.auth.get_user(jwt_token)
        if not user_response or not user_response.user:
            raise ValueError("Token inválido")
        user_id = user_response.user.id
    except Exception:
        raise ValueError("Token inválido o expirado")
    
    if 'avatar' not in request.files:
        raise ValueError("No se envió ningún avatar")
    
    file = request.files['avatar']
    if file.filename == '':
        raise ValueError("Archivo sin nombre")
    
    allowed_extensions = {'png', 'jpg', 'jpeg', 'webp'}
    file_ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
    if file_ext not in allowed_extensions:
        raise ValueError(f"Formato no permitido. Use: {', '.join(allowed_extensions)}")
    
    unique_filename = f"avatar_{user_id}.{file_ext}"
    logger.info(f"Subiendo avatar para usuario {user_id}: {unique_filename}")
    
    try:
        file_content = file.read()
        content_type = f"image/{file_ext}" if file_ext != 'jpg' else 'image/jpeg'
        
        response = supabase.storage.from_("arboles-fotos").upload(
            path=f"avatars/{unique_filename}",
            file=file_content,
            file_options={
                "content-type": content_type,
                "cache-control": "3600",
                "upsert": "true"
            }
        )
        
        public_url = supabase.storage.from_("arboles-fotos").get_public_url(f"avatars/{unique_filename}")
        
        logger.info(f"Avatar subido exitosamente: {public_url}")
        return jsonify({
            "avatar_url": public_url,
            "filename": unique_filename
        }), 201
        
    except Exception as e:
        logger.error(f"Error al subir avatar: {str(e)}", exc_info=True)
        raise Exception(f"Error al subir avatar: {str(e)}")

# --- ESTADÍSTICAS ---
@app.route("/api/predecir_horas", methods=['GET'])
@handle_errors
def predecir_horas():
    response = supabase.table("arboles_sembrados").select("id", count='exact').execute()
    conteo = response.count if hasattr(response, 'count') and response.count is not None else 0
    return jsonify({
        "arboles_totales": conteo,
        "horas_estimadas": round(conteo * 1.5, 1)
    }), 200

@app.route("/api/estadisticas_graficos", methods=['GET'])
@handle_errors
def estadisticas_graficos():
    logger.info("Generando datos para gráficos...")
    response = supabase.table("arboles_sembrados").select("especie, fecha_siembra").execute()

    if not response.data:
        return jsonify({"arboles_por_mes": {}, "top_especies": {}}), 200

    arboles = response.data
    from collections import defaultdict

    arboles_por_mes = defaultdict(int)
    for arbol in arboles:
        try:
            fecha_str = arbol['fecha_siembra']
            if fecha_str:
                 if fecha_str.endswith('Z'):
                      fecha_str = fecha_str[:-1] + '+00:00'
                 fecha = datetime.fromisoformat(fecha_str)
                 mes_año = fecha.strftime('%Y-%m')
                 arboles_por_mes[mes_año] += 1
        except (ValueError, TypeError, KeyError) as e:
             logger.warning(f"Error al procesar fecha '{arbol.get('fecha_siembra')}': {e}")
             continue

    especies_count = defaultdict(int)
    for arbol in arboles:
        especie = arbol.get('especie')
        if especie:
            especies_count[especie.strip()] += 1

    top_especies_sorted = sorted(especies_count.items(), key=lambda item: item[1], reverse=True)
    top_especies = dict(top_especies_sorted[:10])
    arboles_por_mes_sorted = dict(sorted(arboles_por_mes.items()))

    return jsonify({
        "arboles_por_mes": arboles_por_mes_sorted,
        "top_especies": top_especies
    }), 200

# --- LOGIN Y SEGURIDAD (RATE LIMITING) ---
@app.route("/api/login", methods=['POST'])
@handle_errors
def login_user():
    datos = request.json
    if not datos:
        raise ValueError("Sin datos")
    
    email = validate_email(datos.get("email", ""))
    password = datos.get("password", "")
    
    if not password:
        raise ValueError("Contraseña requerida")
    
    # RATE LIMITING: Solo verificar bloqueo por email
    email_lower = email.lower()
    
    # Verificar estado de bloqueo
    is_blocked, attempts_left, blocked_until = check_rate_limit(email_lower)
    
    if is_blocked:
        now = datetime.utcnow()
        time_left_seconds = max(0, int((blocked_until - now).total_seconds()))
        minutes_left = time_left_seconds // 60
        seconds_left = time_left_seconds % 60
        
        logger.warning(f"🚫 Intento de login bloqueado para email: {email} (IP: {get_client_ip()} - solo para logs)")
        
        return jsonify({
            "error": "Demasiados intentos fallidos",
            "blocked": True,
            "blocked_until": blocked_until.isoformat() + 'Z',
            "time_left_seconds": time_left_seconds,
            "message": f"Tu correo ha sido bloqueado temporalmente. Intenta nuevamente en {minutes_left}m {seconds_left}s"
        }), 429
    
    # Solo para logs (no afecta el bloqueo)
    client_ip = get_client_ip()
    logger.info(f"🔑 Intento de login para: {email} desde IP: {client_ip} (intentos restantes: {attempts_left})")
    
    try:
        # Intentar autenticación con Supabase
        response = supabase.auth.sign_in_with_password({"email": email, "password": password})

        if response.user and response.session:
            # LOGIN EXITOSO: Resetear contador de intentos
            reset_attempts(email_lower)
            
            logger.info(f"✅ Login exitoso para {email}. User ID: {response.user.id}")
            user_data = response.user.dict()
            session_data = response.session.dict()

            # Obtener nombre del usuario
            user_name = user_data.get("user_metadata", {}).get("name")
            if not user_name:
                user_name = email.split('@')[0]
            user_data['name'] = user_name

            return jsonify({
                "user": user_data,
                "session": session_data,
                "attempts_left": MAX_LOGIN_ATTEMPTS
            }), 200
        else:
            raise ValueError("Credenciales inválidas o error inesperado.")

    except Exception as e:
        error_msg = str(e)
        logger.warning(f"❌ Fallo de login para {email}: {error_msg}")
        
        # Registrar intento fallido
        just_blocked = record_failed_attempt(email_lower)
        
        # Obtener nuevo estado después de registrar el fallo
        _, attempts_left, blocked_until_new = check_rate_limit(email_lower)
        
        # Si acabamos de bloquear
        if just_blocked:
            lockout_minutes = int(LOCKOUT_DURATION.total_seconds() / 60)
            time_left_seconds = int(LOCKOUT_DURATION.total_seconds())
            minutes_left = time_left_seconds // 60
            seconds_left = time_left_seconds % 60
            
            return jsonify({
                "error": "Demasiados intentos fallidos",
                "blocked": True,
                "blocked_until": blocked_until_new.isoformat() + 'Z' if blocked_until_new else None,
                "time_left_seconds": time_left_seconds,
                "message": f"Tu correo ha sido bloqueado por {minutes_left}m {seconds_left}s debido a múltiples intentos fallidos"
            }), 429
        
        # Preparar mensaje de error
        if "invalid login credentials" in error_msg.lower() or "invalid" in error_msg.lower():
            error_message = f"Credenciales inválidas. Te quedan {attempts_left} intentos antes del bloqueo."
        elif "email not confirmed" in error_msg.lower():
            error_message = "Email no confirmado. Revisa tu bandeja de entrada."
        else:
            error_message = f"Error de autenticación. Intentos restantes: {attempts_left}"
        
        return jsonify({
            "error": error_message,
            "blocked": False,
            "attempts_left": attempts_left
        }), 401

@app.route("/api/check_lockout", methods=['POST'])
@handle_errors
def check_lockout_status():
    datos = request.json
    email = datos.get("email", "").strip().lower()
    
    if not email:
        return jsonify({
            "blocked": False,
            "attempts_left": MAX_LOGIN_ATTEMPTS
        }), 200
    
    # Verificar estado actual
    is_blocked, attempts_left, blocked_until = check_rate_limit(email)
    
    if is_blocked and blocked_until:
        now = datetime.utcnow()
        time_left_seconds = max(0, int((blocked_until - now).total_seconds()))
        minutes_left = time_left_seconds // 60
        seconds_left = time_left_seconds % 60
        
        return jsonify({
            "blocked": True,
            "blocked_until": blocked_until.isoformat() + 'Z',
            "time_left_seconds": time_left_seconds,
            "attempts_left": 0,
            "message": f"Tu correo está bloqueado. Tiempo restante: {minutes_left}m {seconds_left}s"
        }), 200
    
    return jsonify({
        "blocked": False,
        "attempts_left": attempts_left
    }), 200

# --- GESTIÓN DE USUARIOS (REGISTER, PROFILE, ETC) ---
@app.route("/api/register", methods=['POST'])
@handle_errors
def register_user():
    datos = request.json
    if not datos:
        raise ValueError("Sin datos")
    
    email = validate_email(datos.get("email", ""))
    password = validate_password(datos.get("password", ""))
    name = sanitize_string(datos.get("name"), min_length=2, max_length=50, field_name="nombre")
    birthdate = datos.get("birthdate", "").strip()

    if not birthdate:
         raise ValueError("Fecha de nacimiento requerida")
    try:
         datetime.strptime(birthdate, '%Y-%m-%d')
    except ValueError:
         raise ValueError("Formato de fecha de nacimiento inválido (use AAAA-MM-DD)")

    logger.info(f"Intentando registrar usuario: {email}")
    try:
        user_response = supabase.auth.sign_up({
            "email": email,
            "password": password,
            "options": {
                "data": {
                    "name": name,
                    "birthdate": birthdate
                }
            }
        })
        
        if user_response and user_response.user:
             return jsonify({
                 "message": "Registro exitoso. Revisa tu email para confirmar la cuenta.",
                 "user_id": user_response.user.id
                 }), 201
        elif hasattr(user_response, 'error') and user_response.error:
             msg = user_response.error.message
             if "already registered" in msg.lower():
                  raise ValueError("Este email ya está registrado.")
             else:
                  raise Exception(f"Error del servicio de autenticación: {msg}")
        else:
             raise Exception("Respuesta inesperada del servicio de autenticación.")

    except Exception as e:
         if isinstance(e, ValueError):
              raise e
         else:
              raise Exception(f"No se pudo completar el registro: {e}")

@app.route("/api/forgot_password", methods=['POST'])
@handle_errors
def send_recovery_email():
    email = validate_email(request.json.get("email", ""))
    logger.info(f"Solicitud de recuperación de contraseña para: {email}")
    try:
        supabase.auth.reset_password_for_email(email)
        return jsonify({"message": "Si el email está registrado, recibirás un correo para restablecer tu contraseña."}), 200
    except Exception as e:
         raise Exception("No se pudo procesar la solicitud de recuperación.")

@app.route("/api/update_password", methods=['POST'])
@handle_errors
def update_password():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
         raise ValueError("Token de autorización faltante o inválido.")
    jwt_token = auth_header.split(' ')[1]
    new_password = validate_password(request.json.get("new_password", ""))

    try:
        user_response = supabase.auth.get_user(jwt_token)
        if not user_response or not user_response.user:
             raise ValueError("Token inválido o expirado.")
        
        update_response = supabase.auth.update_user(attributes={'password': new_password})
        if update_response and update_response.user:
             return jsonify({"message": "Contraseña actualizada correctamente."}), 200
        else:
             raise Exception("No se pudo actualizar la contraseña debido a un error inesperado.")
    except Exception as e:
        error_msg = str(e)
        if "invalid token" in error_msg.lower():
             raise ValueError("Token inválido o expirado.")
        raise Exception(f"Error al actualizar la contraseña: {error_msg}")

@app.route("/api/update_profile", methods=['PUT'])
@handle_errors
def update_profile():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        raise ValueError("Token de autorización faltante o inválido.")
    jwt_token = auth_header.split(' ')[1]
    datos = request.json
    
    if not datos:
        raise ValueError("Sin datos para actualizar")
    
    try:
        user_response = supabase.auth.get_user(jwt_token)
        if not user_response or not user_response.user:
            raise ValueError("Token inválido o expirado.")
        
        user_id = user_response.user.id
        updates = {}
        if "name" in datos:
            updates["name"] = sanitize_string(datos["name"], min_length=2, max_length=50, field_name="nombre")
        if "birthdate" in datos:
            birthdate = datos["birthdate"].strip()
            if birthdate:
                try:
                    datetime.strptime(birthdate, '%Y-%m-%d')
                    updates["birthdate"] = birthdate
                except ValueError:
                    raise ValueError("Formato de fecha inválido")
        if "avatar_url" in datos:
            updates["avatar_url"] = datos["avatar_url"]
        
        if updates:
            supabase.auth.update_user(attributes={'data': updates})
        
        password_changed = False
        if "current_password" in datos and "new_password" in datos:
            current_password = datos["current_password"]
            new_password = validate_password(datos["new_password"])
            try:
                email = user_response.user.email
                verify_response = supabase.auth.sign_in_with_password({"email": email, "password": current_password})
                if not verify_response.user:
                    raise ValueError("Contraseña actual incorrecta")
            except Exception:
                raise ValueError("Contraseña actual incorrecta")
            
            pwd_response = supabase.auth.update_user(attributes={'password': new_password})
            if pwd_response and pwd_response.user:
                password_changed = True
        
        final_user = supabase.auth.get_user(jwt_token)
        response_message = "Perfil actualizado correctamente"
        if password_changed:
            response_message += " (contraseña cambiada)"
        
        return jsonify({
            "message": response_message,
            "user": final_user.user.dict()
        }), 200
        
    except ValueError as e:
        raise e
    except Exception as e:
        raise Exception(f"Error al actualizar el perfil: {str(e)}")

# --- MANEJO DE ERRORES ---
@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Recurso no encontrado"}), 404

@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({"error": "Método no permitido"}), 405

@app.errorhandler(413)
def payload_too_large(error):
    return jsonify({"error": f"El archivo es demasiado grande (límite: 5MB)."}), 413

@app.errorhandler(Exception)
def internal_error(error):
    logger.critical(f"Error interno no capturado: {error}", exc_info=True)
    return jsonify({"error": "Ocurrió un error interno inesperado en el servidor."}), 500

# --- INICIO ---
if __name__ == "__main__":
    host = os.environ.get('FLASK_RUN_HOST', '0.0.0.0')
    port = int(os.environ.get('FLASK_RUN_PORT', 5000))
    debug_mode = os.environ.get('FLASK_DEBUG', 'True').lower() in ['true', '1', 't']

    logger.info(f"Iniciando Reforesta Manabí en {host}:{port} (Debug: {debug_mode})...")
    app.run(debug=debug_mode, host=host, port=port)