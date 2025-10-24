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
    # Busca 'index.html' en la carpeta 'templates'
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


# --- 6. Ejecutar la Aplicación ---
if __name__ == "__main__":
    app.run(debug=True) # debug=True te ayuda a ver errores