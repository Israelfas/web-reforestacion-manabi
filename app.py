import os
import logging
from datetime import datetime
from flask import Flask, render_template, request, jsonify
from supabase import create_client, Client
from dotenv import load_dotenv
from functools import wraps
import uuid

load_dotenv()

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

app = Flask(__name__)
app.config['JSON_SORT_KEYS'] = False
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024  # 5MB para fotos

# --- Decoradores y Validaciones ---
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
    """Valida que la contraseña cumpla con los requisitos mínimos"""
    if not password or not isinstance(password, str):
        raise ValueError("Contraseña inválida")
    if len(password) < 8:
        raise ValueError("La contraseña debe tener al menos 8 caracteres")
    return password.strip()

def validate_email(email):
    """Valida formato básico de email"""
    if not email or not isinstance(email, str):
        raise ValueError("Email inválido")
    email = email.strip().lower()
    if '@' not in email or '.' not in email.split('@')[-1]:
        raise ValueError("Formato de email inválido")
    if len(email) < 5 or len(email) > 100:
        raise ValueError("Email debe tener entre 5 y 100 caracteres")
    return email

# --- Rutas Principales ---
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
                         storage_response = supabase.storage.from_("arboles-fotos").remove([filename])
                         logger.info(f"Solicitud de eliminación de foto {filename} enviada al storage.")
                    else:
                         logger.warning(f"No se pudo extraer filename válido de la URL: {foto_url_a_eliminar}")

        except Exception as e:
            logger.warning(f"No se pudo eliminar la foto {foto_url_a_eliminar} del storage (el registro del árbol ya fue eliminado): {e}")

    return jsonify({"message": f"Árbol {arbol_id} eliminado exitosamente (y foto asociada, si existía, marcada para eliminar)", "id": arbol_id}), 200

# --- SUBIDA DE FOTOS ---
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

        response = supabase.storage.from_("arboles-fotos").upload(
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
    response = supabase.table("arboles_sembrados") \
        .select("especie, fecha_siembra").execute()

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

# --- AUTENTICACIÓN CON VALIDACIÓN MEJORADA ---
@app.route("/api/register", methods=['POST'])
@handle_errors
def register_user():
    datos = request.json
    if not datos:
        raise ValueError("Sin datos")
    
    # Validaciones mejoradas
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
             logger.info(f"Usuario {email} registrado pendiente de confirmación. ID: {user_response.user.id}")
             return jsonify({
                 "message": "Registro exitoso. Revisa tu email para confirmar la cuenta.",
                 "user_id": user_response.user.id
                 }), 201
        elif hasattr(user_response, 'error') and user_response.error:
             msg = user_response.error.message
             logger.warning(f"Error de Supabase al registrar {email}: {msg}")
             if "already registered" in msg.lower():
                  raise ValueError("Este email ya está registrado.")
             else:
                  raise Exception(f"Error del servicio de autenticación: {msg}")
        else:
             logger.error(f"Respuesta inesperada de Supabase Auth al registrar {email}: {user_response}")
             raise Exception("Respuesta inesperada del servicio de autenticación.")

    except Exception as e:
         logger.error(f"Excepción durante el registro de {email}: {e}", exc_info=True)
         if isinstance(e, ValueError):
              raise e
         else:
              raise Exception(f"No se pudo completar el registro: {e}")

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

    logger.info(f"Intento de login para: {email}")
    try:
        response = supabase.auth.sign_in_with_password({"email": email, "password": password})

        if response.user and response.session:
            logger.info(f"Login exitoso para {email}. User ID: {response.user.id}")
            user_data = response.user.dict()
            session_data = response.session.dict()

            user_name = user_data.get("user_metadata", {}).get("name")

            if not user_name:
                 user_name = email.split('@')[0]

            user_data['name'] = user_name

            return jsonify({
                 "user": user_data,
                 "session": session_data
            }), 200
        else:
             logger.warning(f"Respuesta inesperada de sign_in_with_password para {email}")
             raise ValueError("Credenciales inválidas o error inesperado.")

    except Exception as e:
        error_msg = str(e)
        logger.warning(f"Fallo de login para {email}: {error_msg}")
        if "invalid login credentials" in error_msg.lower():
            raise ValueError("Credenciales inválidas.")
        elif "email not confirmed" in error_msg.lower():
            raise ValueError("Email no confirmado. Revisa tu bandeja de entrada.")
        else:
            raise Exception(f"Error de autenticación: {error_msg}")

@app.route("/api/forgot_password", methods=['POST'])
@handle_errors
def send_recovery_email():
    email = validate_email(request.json.get("email", ""))

    logger.info(f"Solicitud de recuperación de contraseña para: {email}")
    try:
        supabase.auth.reset_password_for_email(email)
        logger.info(f"Correo de recuperación enviado (o simulado) a {email}.")
        return jsonify({"message": "Si el email está registrado, recibirás un correo para restablecer tu contraseña."}), 200
    except Exception as e:
         logger.error(f"Error al enviar correo de recuperación para {email}: {e}", exc_info=True)
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

        user_id = user_response.user.id
        logger.info(f"Usuario {user_id} intentando actualizar contraseña.")

        update_response = supabase.auth.update_user(attributes={'password': new_password})

        if update_response and update_response.user:
             logger.info(f"Contraseña actualizada exitosamente para usuario {user_id}.")
             return jsonify({"message": "Contraseña actualizada correctamente."}), 200
        else:
             logger.error(f"Respuesta inesperada al actualizar contraseña para {user_id}: {update_response}")
             raise Exception("No se pudo actualizar la contraseña debido a un error inesperado.")

    except Exception as e:
        logger.error(f"Error al actualizar contraseña: {e}", exc_info=True)
        error_msg = str(e)
        if "invalid token" in error_msg.lower():
             raise ValueError("Token inválido o expirado.")
        raise Exception(f"Error al actualizar la contraseña: {error_msg}")

# --- MANEJO DE ERRORES GENÉRICOS DE FLASK ---
@app.errorhandler(404)
def not_found(error):
    logger.warning(f"Ruta no encontrada: {request.url}")
    return jsonify({"error": "Recurso no encontrado"}), 404

@app.errorhandler(405)
def method_not_allowed(error):
    logger.warning(f"Método {request.method} no permitido para la ruta: {request.url}")
    return jsonify({"error": "Método no permitido"}), 405

@app.errorhandler(413)
def payload_too_large(error):
    logger.warning(f"Payload demasiado grande recibido en {request.url}. Límite: {app.config['MAX_CONTENT_LENGTH']} bytes.")
    return jsonify({"error": f"El archivo o la solicitud es demasiado grande (límite: {app.config['MAX_CONTENT_LENGTH'] // 1024 // 1024}MB)."}), 413

@app.errorhandler(Exception)
def internal_error(error):
    logger.critical(f"Error interno no capturado: {error}", exc_info=True)
    return jsonify({"error": "Ocurrió un error interno inesperado en el servidor."}), 500

# --- INICIO DE LA APP ---
if __name__ == "__main__":
    host = os.environ.get('FLASK_RUN_HOST', '0.0.0.0')
    port = int(os.environ.get('FLASK_RUN_PORT', 5000))
    debug_mode = os.environ.get('FLASK_DEBUG', 'True').lower() in ['true', '1', 't']

    logger.info(f"Iniciando Reforesta Manabí en {host}:{port} (Debug: {debug_mode})...")
    app.run(debug=debug_mode, host=host, port=port)