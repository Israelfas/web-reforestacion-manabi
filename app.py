import os
import logging
from datetime import datetime
from flask import Flask, render_template, request, jsonify
from supabase import create_client, Client
from dotenv import load_dotenv
from functools import wraps

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
    
    # Obtener user_email del token (placeholder por ahora)
    user_email = datos.get("user_email", "usuario@ejemplo.com")
    foto_url = datos.get("foto_url")  # URL de Supabase Storage

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

    if not response.data:
        raise Exception("No se pudo insertar el árbol")

    logger.info(f"Árbol plantado ID: {response.data[0].get('id')}")
    return jsonify(response.data[0]), 201

@app.route("/api/editar_arbol/<int:arbol_id>", methods=['PUT'])
@handle_errors
def editar_arbol(arbol_id):
    """Edita un árbol existente"""
    datos = request.json
    if not datos:
        raise ValueError("Sin datos para actualizar")

    updates = {}
    
    if "especie" in datos:
        updates["especie"] = sanitize_string(datos["especie"], field_name="especie")
    
    if "latitud" in datos and "longitud" in datos:
        lat, lng = validate_coordinates(datos["latitud"], datos["longitud"])
        updates["latitud"] = round(lat, 6)
        updates["longitud"] = round(lng, 6)
    
    if "foto_url" in datos:
        updates["foto_url"] = datos["foto_url"]

    if not updates:
        raise ValueError("No hay cambios para aplicar")

    logger.info(f"Editando árbol ID {arbol_id}: {updates}")
    response = supabase.table("arboles_sembrados") \
        .update(updates).eq("id", arbol_id).execute()

    if not response.data:
        raise Exception("No se pudo actualizar el árbol")

    logger.info(f"Árbol {arbol_id} actualizado")
    return jsonify(response.data[0]), 200

@app.route("/api/eliminar_arbol/<int:arbol_id>", methods=['DELETE'])
@handle_errors
def eliminar_arbol(arbol_id):
    """Elimina un árbol"""
    logger.info(f"Eliminando árbol ID {arbol_id}")
    
    # Primero obtener la foto_url para eliminarla del storage si existe
    tree_response = supabase.table("arboles_sembrados") \
        .select("foto_url").eq("id", arbol_id).single().execute()
    
    if tree_response.data and tree_response.data.get("foto_url"):
        try:
            # Extraer el path de la URL de Supabase Storage
            foto_url = tree_response.data["foto_url"]
            if "arboles-fotos" in foto_url:
                path = foto_url.split("arboles-fotos/")[-1].split("?")[0]
                supabase.storage.from_("arboles-fotos").remove([path])
                logger.info(f"Foto eliminada del storage: {path}")
        except Exception as e:
            logger.warning(f"No se pudo eliminar foto: {e}")

    # Eliminar el registro de la base de datos
    response = supabase.table("arboles_sembrados") \
        .delete().eq("id", arbol_id).execute()

    if not response.data:
        raise Exception("No se pudo eliminar el árbol")

    logger.info(f"Árbol {arbol_id} eliminado")
    return jsonify({"message": "Árbol eliminado exitosamente", "id": arbol_id}), 200

# --- ESTADÍSTICAS Y GRÁFICOS ---

@app.route("/api/predecir_horas", methods=['GET'])
@handle_errors
def predecir_horas():
    response = supabase.table("arboles_sembrados").select("id", count='exact').execute()
    conteo = response.count if response.count is not None else 0
    return jsonify({
        "arboles_totales": conteo,
        "horas_estimadas": round(conteo * 1.5, 1)
    }), 200

@app.route("/api/estadisticas_graficos", methods=['GET'])
@handle_errors
def estadisticas_graficos():
    """Obtiene datos para los gráficos"""
    logger.info("Generando datos para gráficos...")
    
    # Obtener todos los árboles
    response = supabase.table("arboles_sembrados") \
        .select("especie, fecha_siembra").execute()
    
    arboles = response.data
    
    # Procesar datos para gráficos
    from collections import defaultdict
    
    # Árboles por mes
    arboles_por_mes = defaultdict(int)
    for arbol in arboles:
        try:
            fecha = datetime.fromisoformat(arbol['fecha_siembra'].replace('Z', '+00:00'))
            mes_año = fecha.strftime('%Y-%m')
            arboles_por_mes[mes_año] += 1
        except:
            continue
    
    # Especies más plantadas
    especies_count = defaultdict(int)
    for arbol in arboles:
        especies_count[arbol['especie']] += 1
    
    # Ordenar y limitar a top 10
    top_especies = dict(sorted(especies_count.items(), key=lambda x: x[1], reverse=True)[:10])
    
    return jsonify({
        "arboles_por_mes": dict(sorted(arboles_por_mes.items())),
        "top_especies": top_especies
    }), 200

# --- AUTENTICACIÓN (sin cambios) ---

@app.route("/api/register", methods=['POST'])
@handle_errors
def register_user():
    datos = request.json
    if not datos: raise ValueError("Sin datos")
    email = datos.get("email", "").strip().lower()
    password = datos.get("password", "")
    name = sanitize_string(datos.get("name"), field_name="nombre")
    birthdate = datos.get("birthdate", "").strip()
    if not email or '@' not in email: raise ValueError("Email inválido")
    if len(password) < 6: raise ValueError("Contraseña muy corta")
    if not birthdate: raise ValueError("Fecha requerida")
    logger.info(f"Registrando: {email}")
    user_response = supabase.auth.sign_up({
        "email": email, "password": password,
        "options": {"data": {"name": name, "birthdate": birthdate}}
    })
    return jsonify(user_response.model_dump()), 201

@app.route("/api/login", methods=['POST'])
@handle_errors
def login_user():
    datos = request.json
    if not datos: raise ValueError("Sin datos")
    email = datos.get("email", "").strip().lower()
    password = datos.get("password", "")
    if not email or not password: raise ValueError("Credenciales requeridas")
    logger.info(f"Login: {email}")
    try:
        session_response = supabase.auth.sign_in_with_password({"email": email, "password": password})
    except:
        raise ValueError("Credenciales inválidas")
    session_data = session_response.model_dump()
    if session_data.get("user") and session_data["user"].get("id"):
        try:
            profile = supabase.table("profiles").select("name").eq("id", session_data["user"]["id"]).maybe_single().execute()
            session_data["user"]["name"] = profile.data.get("name") if profile.data else email.split('@')[0]
        except:
            session_data["user"]["name"] = email.split('@')[0]
    return jsonify(session_data), 200

@app.route("/api/forgot_password", methods=['POST'])
@handle_errors
def send_recovery_email():
    email = request.json.get("email", "").strip().lower()
    if not email: raise ValueError("Email requerido")
    supabase.auth.reset_password_email(email)
    return jsonify({"message": "Correo enviado"}), 200

@app.route("/api/update_password", methods=['POST'])
@handle_errors
def update_password():
    datos = request.json
    token = datos.get("access_token")
    password = datos.get("new_password")
    if not token or len(password) < 6: raise ValueError("Datos inválidos")
    user = supabase.auth.get_user(jwt=token)
    if not user.user: raise ValueError("Token inválido")
    supabase.auth.update_user(attributes={"password": password})
    return jsonify({"message": "Contraseña actualizada"}), 200

# --- MANEJO DE ERRORES ---

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "No encontrado"}), 404

@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({"error": "Método no permitido"}), 405

@app.errorhandler(413)
def payload_too_large(error):
    return jsonify({"error": "Archivo muy grande"}), 413

@app.errorhandler(Exception)
def internal_error(error):
    logger.error(f"Error: {error}", exc_info=True)
    return jsonify({"error": "Error interno"}), 500

if __name__ == "__main__":
    logger.info("Iniciando Reforesta Manabí...")
    app.run(debug=True, host='0.0.0.0', port=5000)