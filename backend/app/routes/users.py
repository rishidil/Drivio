from flask import Blueprint, request, jsonify
from app import supabase

users_bp = Blueprint("users", __name__)

@users_bp.route("/settings", methods=["GET"])
def get_settings():
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400

    result = supabase.table("user_settings") \
        .select("*") \
        .eq("id", user_id) \
        .single() \
        .execute()

    return jsonify(result.data)

@users_bp.route("/settings", methods=["PATCH"])
def update_settings():
    data = request.json
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400

    updates = {k: v for k, v in data.items() if k != "user_id"}

    result = supabase.table("user_settings") \
        .update(updates) \
        .eq("id", user_id) \
        .execute()

    return jsonify(result.data[0])