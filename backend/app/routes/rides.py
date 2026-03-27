from flask import Blueprint, request, jsonify
from app import supabase

rides_bp = Blueprint("rides", __name__)

@rides_bp.route("/", methods=["GET"])
def get_rides():
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400

    result = supabase.table("rides") \
        .select("*") \
        .eq("user_id", user_id) \
        .order("started_at", desc=True) \
        .execute()

    return jsonify(result.data)

@rides_bp.route("/", methods=["POST"])
def create_ride():
    data = request.json
    required = ["user_id", "started_at", "ended_at", "start_lat",
                "start_lng", "end_lat", "end_lng", "start_address",
                "end_address", "distance_miles", "gas_used",
                "gas_cost", "duration_seconds"]

    for field in required:
        if field not in data:
            return jsonify({"error": f"{field} is required"}), 400

    result = supabase.table("rides").insert(data).execute()
    return jsonify(result.data[0]), 201

@rides_bp.route("/<ride_id>", methods=["DELETE"])
def delete_ride(ride_id):
    supabase.table("rides").delete().eq("id", ride_id).execute()
    return jsonify({"message": "deleted"}), 200