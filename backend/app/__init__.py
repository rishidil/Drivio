from flask import Flask
from flask_cors import CORS
from supabase import create_client
from config import Config

supabase = None

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    CORS(app, origins=["http://localhost:5173"])

    global supabase
    supabase = create_client(
        app.config["SUPABASE_URL"],
        app.config["SUPABASE_SERVICE_KEY"]
    )

    from app.routes.rides import rides_bp
    from app.routes.users import users_bp
    app.register_blueprint(rides_bp, url_prefix="/rides")
    app.register_blueprint(users_bp, url_prefix="/users")

    @app.route("/health")
    def health():
        return {"status": "ok"}

    return app