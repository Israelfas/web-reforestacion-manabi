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
    return render_template("index.html")

# --- 3. API: Obtener todos los árboles ---
@app.route("/api/obtener_arboles", methods=['GET'])
def obtener_arboles():
    try:
        data = supabase.table("arboles_sembrados").select("*").execute()
        return jsonify(data.data) 
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- 4. API: Guardar un árbol nuevo ---
@app.route("/api/plantar_arbol", methods=['POST'])
def plantar_arbol():
    try:
        datos = request.json 
        nuevo_arbol = {
            "especie": datos.get("especie"),
            "latitud": datos.get("latitud"),
            "longitud": datos.get("longitud"),
        }
        data = supabase.table("arboles_sembrados").insert(nuevo_arbol).execute()
        return jsonify(data.data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- 5. API: "IA" Sencilla (Predicción) ---
@app.route("/api/predecir_horas", methods=['GET'])
def predecir_horas():
    try:
        data_arboles = supabase.table("arboles_sembrados").select("id", count='exact').execute()
        conteo_actual = data_arboles.count
        horas_estimadas = conteo_actual * 1.5
        return jsonify({
            "arboles_totales": conteo_actual,
            "horas_estimadas": horas_estimadas,
            "mensaje_ia": "Estimación basada en 1.5h por árbol."
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- 6. API: Registro de Nuevo Usuario (ACTUALIZADO) ---
@app.route("/api/register", methods=['POST'])
def register_user():
    try:
        datos = request.json
        email = datos.get("email")
        password = datos.get("password")
        name = datos.get("name")            # NUEVO
        birthdate = datos.get("birthdate")  # NUEVO
        
        # Pasamos name y birthdate como metadata. El trigger los usará.
        user_response = supabase.auth.sign_up(
            {
                "email": email,
                "password": password,
                "options": {
                    "data": {
                        "name": name,
                        "birthdate": birthdate
                    }
                }
            }
        )
        return jsonify(user_response.model_dump())
    
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# --- 7. API: Inicio de Sesión de Usuario (ACTUALIZADO) ---
@app.route("/api/login", methods=['POST'])
def login_user():
    try:
        datos = request.json
        email = datos.get("email")
        password = datos.get("password")
        
        session_response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password,
        })
        
        session_data = session_response.model_dump()
        
        # --- ¡¡AQUÍ ESTÁ EL CAMBIO!! ---
        # Si el login fue exitoso, buscamos el nombre en la tabla 'profiles'
        if session_data.get("user") and session_data["user"].get("id"):
            user_id = session_data["user"]["id"]
            try:
                # Consultamos la tabla profiles
                profile_response = supabase.table("profiles").select("name").eq("id", user_id).single().execute()
                if profile_response.data and profile_response.data.get("name"):
                    session_data["user"]["name"] = profile_response.data["name"] # Añadimos el nombre a la respuesta
                else:
                    # Si no hay perfil o nombre, usamos el email como fallback
                    session_data["user"]["name"] = session_data["user"]["email"].split('@')[0] 
            except Exception as profile_error:
                 # Si falla la búsqueda de perfil, usamos el email como fallback
                 print(f"Error al buscar perfil: {profile_error}")
                 session_data["user"]["name"] = session_data["user"]["email"].split('@')[0]
        # --- FIN DEL CAMBIO ---

        return jsonify(session_data)
    
    except Exception as e:
        return jsonify({"error": "Credenciales inválidas"}), 401

# --- 8. API para Pedir Recuperación de Contraseña ---
@app.route("/api/forgot_password", methods=['POST'])
def send_recovery_email():
    try:
        datos = request.json
        email = datos.get("email")
        supabase.auth.reset_password_email(email)
        return jsonify({"message": "Correo de recuperación enviado."})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# --- 9. API para Actualizar la Contraseña ---
@app.route("/api/update_password", methods=['POST'])
def update_password():
    try:
        datos = request.json
        access_token = datos.get("access_token")
        new_password = datos.get("new_password")
        supabase.auth.set_session(access_token=access_token, refresh_token=access_token)
        updated_user = supabase.auth.update_user({"password": new_password})
        return jsonify(updated_user.model_dump())
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# --- 10. Ejecutar la Aplicación ---
if __name__ == "__main__":
    app.run(debug=True)