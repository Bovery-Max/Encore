from flask import Flask, jsonify, request
import sqlite3
import json
import os

app = Flask(__name__, static_folder="static", static_url_path="")
app.json.sort_keys = False  # prodüksiyon kategorilerinin sırası korunmalı
DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "encore.db")


def db_hazirla():
    conn = sqlite3.connect(DB)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS projeler (
            id TEXT PRIMARY KEY,
            name TEXT,
            created_at TEXT,
            data TEXT
        )
    """)
    conn.commit()
    conn.close()


db_hazirla()


@app.route("/")
def anasayfa():
    return app.send_static_file("index.html")


@app.route("/api/projeler", methods=["GET"])
def projeleri_getir():
    conn = sqlite3.connect(DB)
    satirlar = conn.execute(
        "SELECT data FROM projeler ORDER BY created_at DESC"
    ).fetchall()
    conn.close()

    liste = []
    for satir in satirlar:
        liste.append(json.loads(satir[0]))

    return jsonify(liste)


@app.route("/api/projeler", methods=["POST"])
def proje_kaydet():
    proje = request.get_json(silent=True)
    if not isinstance(proje, dict) or not proje.get("id"):
        return jsonify({"hata": "proje id'si gerekli"}), 400

    conn = sqlite3.connect(DB)
    conn.execute(
        "INSERT OR REPLACE INTO projeler (id, name, created_at, data) VALUES (?, ?, ?, ?)",
        (proje["id"], proje.get("name", ""), proje.get("createdAt", ""), json.dumps(proje))
    )
    conn.commit()
    conn.close()

    return jsonify({"durum": "kaydedildi"})


@app.route("/api/projeler/<proje_id>", methods=["DELETE"])
def proje_sil(proje_id):
    conn = sqlite3.connect(DB)
    conn.execute("DELETE FROM projeler WHERE id = ?", (proje_id,))
    conn.commit()
    conn.close()

    return jsonify({"durum": "silindi"})


if __name__ == "__main__":
    app.run(debug=True, port=5001)
