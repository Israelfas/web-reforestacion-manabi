import os
from flask import Flask, render_template, request, jsonify
from supabase import create_client, Client
from dotenv import load_dotenv

# Carga las variables del archivo .env
load_dotenv() 

# --- 1. Configuración de Conexiones ---
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

app = Flask(__name__) # Inicializa Flask

# --- 2. Ruta Principal (Sirve la página web) ---
@app.route("/")
def home():
    # 'render_template' busca en la carpeta 'templates'
    return render_template("index.html")

# --- 3. API: Obtener todos los árboles ---
@app.route("/api/obtener_arboles", methods=['GET'])
def obtener_arboles():
    try:
        data = supabase.table("arboles_sembrados").select("*").execute()
        return jsonify(data.data) # Devuelve los datos como JSON
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- 4. API: Guardar un árbol nuevo ---
@app.route("/api/plantar_arbol", methods=['POST'])
def plantar_arbol():
    try:
        datos = request.json # Obtiene el JSON enviado desde la web
        
        nuevo_arbol = {
            "especie": datos.get("especie"),
            "latitud": datos.get("latitud"),
            "longitud": datos.get("longitud"),
        }
        
        # Inserta en la tabla 'arboles_sembrados'
        data = supabase.table("arboles_sembrados").insert(nuevo_arbol).execute()
        return jsonify(data.data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- 5. API: "IA" Sencilla (Predicción) ---
@app.route("/api/predecir_horas", methods=['GET'])
def predecir_horas():
    try:
        # Lógica simple: Contar cuántos árboles hay en la BD
        data_arboles = supabase.table("arboles_sembrados").select("id", count='exact').execute()
        conteo_actual = data_arboles.count
        
        # Predicción simple: Asumir que cada árbol toma 1.5 horas
        horas_estimadas = conteo_actual * 1.5
        
        return jsonify({
            "arboles_totales": conteo_actual,
            "horas_estimadas": horas_estimadas,
            "mensaje_ia": "Estimación basada en 1.5h por árbol."
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- 6. API: Registro de Nuevo Usuario ---
@app.route("/api/register", methods=['POST'])
def register_user():
    try:
        datos = request.json
        email = datos.get("email")
        password = datos.get("password")
        
        # Usamos Supabase Auth para crear el usuario
        user_response = supabase.auth.sign_up({
            "email": email,
            "password": password,
        })
        
        # Convertimos el objeto Pydantic a JSON
        return jsonify(user_response.model_dump())
    
    except Exception as e:
        # Manejamos errores, ej: "User already registered"
        return jsonify({"error": str(e)}), 400

# --- 7. API: Inicio de Sesión de Usuario ---
@app.route("/api/login", methods=['POST'])
def login_user():
    try:
        datos = request.json
        email = datos.get("email")
        password = datos.get("password")
        
        # Usamos Supabase Auth para iniciar sesión
        session_response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password,
        })
        
        # Convertimos el objeto Pydantic a JSON
        return jsonify(session_response.model_dump())
    
    except Exception as e:
        # Manejamos errores, ej: "Invalid login credentials"
        return jsonify({"error": "Credenciales inválidas"}), 401

# --- 8. API para Pedir Recuperación de Contraseña ---
@app.route("/api/forgot_password", methods=['POST'])
def send_recovery_email():
    try:
        datos = request.json
        email = datos.get("email")
        
        # --- ¡¡AQUÍ ESTÁ LA CORRECCIÓN!! ---
        # La función correcta es 'reset_password_email'
        supabase.auth.reset_password_email(email)
        # --- FIN DE LA CORRECCIÓN ---
        
        return jsonify({"message": "Correo de recuperación enviado. Revisa tu bandeja de entrada."})
    
    except Exception as e:
        # Imprimimos el error en la terminal para saber qué pasa.
        print("!!!!!!!!!! ERROR DE RECUPERACIÓN (FORGOT PW) !!!!!!!!!!")
        print(f"Detalle del error: {e}")
        print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        
        return jsonify({"error": str(e)}), 400

# --- 9. API para Actualizar la Contraseña ---
@app.route("/api/update_password", methods=['POST'])
def update_password():
    try:
        datos = request.json
        access_token = datos.get("access_token")
        new_password = datos.get("new_password")
        
        # 1. Usamos el token para establecer la sesión del usuario
        # ¡¡CORRECCIÓN AQUÍ TAMBIÉN!! set_session no devuelve nada.
        supabase.auth.set_session(access_token=access_token, refresh_token=access_token) # Usamos el token para ambas
        
        # 2. Una vez la sesión está activa, actualizamos el usuario
        updated_user = supabase.auth.update_user(
            {"password": new_password}
        )
        
        return jsonify(updated_user.model_dump())
        
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# --- 10. Ejecutar la Aplicación ---
if __name__ == "__main__":
    app.run(debug=True) # debug=True te ayuda a ver errores