import os
from flask import Flask, render_template, request, jsonify
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# --- Configuración ---
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)
app = Flask(__name__)

# --- Ruta Principal ---
@app.route("/")
def home():
    return render_template("index.html")

# --- APIs ---
@app.route("/api/obtener_arboles", methods=['GET'])
def obtener_arboles():
    try:
        data = supabase.table("arboles_sembrados").select("*").execute()
        return jsonify(data.data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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

@app.route("/api/predecir_horas", methods=['GET'])
def predecir_horas():
    try:
        data_arboles = supabase.table("arboles_sembrados").select("id", count='exact').execute()
        conteo_actual = data_arboles.count
        return jsonify({
            "arboles_totales": conteo_actual,
            "horas_estimadas": conteo_actual * 1.5,
            "mensaje_ia": "Estimación basada en 1.5h por árbol."
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/register", methods=['POST'])
def register_user():
    try:
        datos = request.json
        user_response = supabase.auth.sign_up({
            "email": datos.get("email"),
            "password": datos.get("password"),
            "options": {
                "data": {
                    "name": datos.get("name"),
                    "birthdate": datos.get("birthdate")
                }
            }
        })
        return jsonify(user_response.model_dump())
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route("/api/login", methods=['POST'])
def login_user():
    try:
        datos = request.json
        session_response = supabase.auth.sign_in_with_password({
            "email": datos.get("email"),
            "password": datos.get("password"),
        })
        
        session_data = session_response.model_dump()
        
        # Obtener nombre desde tabla profiles
        if session_data.get("user") and session_data["user"].get("id"):
            user_id = session_data["user"]["id"]
            try:
                profile_response = supabase.table("profiles").select("name").eq("id", user_id).single().execute()
                session_data["user"]["name"] = profile_response.data.get("name") if profile_response.data else session_data["user"]["email"].split('@')[0]
            except Exception as profile_error:
                print(f"Error al buscar perfil: {profile_error}")
                session_data["user"]["name"] = session_data["user"]["email"].split('@')[0]
        
        return jsonify(session_data)
    except Exception as e:
        return jsonify({"error": "Credenciales inválidas"}), 401

@app.route("/api/forgot_password", methods=['POST'])
def send_recovery_email():
    try:
        supabase.auth.reset_password_email(request.json.get("email"))
        return jsonify({"message": "Correo de recuperación enviado."})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route("/api/update_password", methods=['POST'])
def update_password():
    try:
        datos = request.json
        access_token = datos.get("access_token")
        supabase.auth.set_session(access_token=access_token, refresh_token=access_token)
        updated_user = supabase.auth.update_user({"password": datos.get("new_password")})
        return jsonify(updated_user.model_dump())
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# --- Ejecutar ---
if __name__ == "__main__":
    app.run(debug=True)