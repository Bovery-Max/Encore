from flask import Flask, jsonify, request
from contextlib import closing
import sqlite3
import json
import os
import re

app = Flask(__name__, static_folder="static", static_url_path="")
app.json.sort_keys = False  # prodüksiyon kategorilerinin sırası korunmalı
app.config["MAX_CONTENT_LENGTH"] = 1 * 1024 * 1024  # 1 MB üstü istek reddedilir (413)
# Sadece yerel adlarla gelen istekler kabul edilir (DNS rebinding saldırısına karşı).
app.config["TRUSTED_HOSTS"] = ["localhost", "127.0.0.1"]

DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "encore.db")

ID_DESENI = re.compile(r"^job_\d{1,16}_[a-z0-9]{1,10}$")
YASAK_ANAHTARLAR = {"__proto__", "constructor", "prototype"}
LISTE_ALANLARI = ("personnel", "fixedCosts", "kesintiler", "gelirAylar", "digerGelirler")


def baglan():
    return closing(sqlite3.connect(DB))


def db_hazirla():
    with baglan() as conn, conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS projeler (
                id TEXT PRIMARY KEY,
                name TEXT,
                created_at TEXT,
                data TEXT
            )
        """)


db_hazirla()


def deger_gecerli(deger, derinlik=0):
    """JSON ağacını gezer: aşırı iç içe yapı, çok uzun metin ve prototip anahtarları reddedilir."""
    if derinlik > 4:
        return False
    if isinstance(deger, dict):
        return all(
            isinstance(k, str) and len(k) <= 100 and k not in YASAK_ANAHTARLAR
            and deger_gecerli(v, derinlik + 1)
            for k, v in deger.items()
        )
    if isinstance(deger, list):
        return len(deger) <= 500 and all(deger_gecerli(v, derinlik + 1) for v in deger)
    if isinstance(deger, str):
        return len(deger) <= 5000
    return deger is None or isinstance(deger, (bool, int, float))


def proje_gecerli(proje):
    if not isinstance(proje, dict):
        return False
    if not isinstance(proje.get("id"), str) or not ID_DESENI.match(proje["id"]):
        return False
    if not isinstance(proje.get("name", ""), str) or not isinstance(proje.get("createdAt", ""), str):
        return False
    for alan in LISTE_ALANLARI:
        if alan in proje and not (
            isinstance(proje[alan], list) and all(isinstance(r, dict) for r in proje[alan])
        ):
            return False
    uretim = proje.get("production", {})
    if not isinstance(uretim, dict) or not all(
        isinstance(v, list) and all(isinstance(r, dict) for r in v) for v in uretim.values()
    ):
        return False
    return deger_gecerli(proje)


@app.before_request
def capraz_site_engelle():
    # Başka bir sitenin tarayıcı üzerinden API'ye istek atmasını engeller (CSRF).
    if request.path.startswith("/api/") and request.headers.get("Sec-Fetch-Site") not in (None, "same-origin", "none"):
        return jsonify({"hata": "izin verilmeyen kaynak"}), 403


@app.after_request
def guvenlik_basliklari(cevap):
    cevap.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src https://fonts.gstatic.com; "
        "img-src 'self' data: blob:; "
        "connect-src 'self'; "
        "object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
    )
    cevap.headers["X-Content-Type-Options"] = "nosniff"
    cevap.headers["X-Frame-Options"] = "DENY"
    cevap.headers["Referrer-Policy"] = "no-referrer"
    return cevap


@app.route("/")
def anasayfa():
    return app.send_static_file("index.html")


@app.route("/api/projeler", methods=["GET"])
def projeleri_getir():
    with baglan() as conn:
        satirlar = conn.execute(
            "SELECT data FROM projeler ORDER BY created_at DESC"
        ).fetchall()

    liste = []
    for satir in satirlar:
        try:
            liste.append(json.loads(satir[0]))
        except (TypeError, ValueError):
            continue  # bozuk kayıt tüm listeyi düşürmesin

    return jsonify(liste)


@app.route("/api/projeler", methods=["POST"])
def proje_kaydet():
    proje = request.get_json(silent=True)  # Content-Type application/json değilse None döner
    if not proje_gecerli(proje):
        return jsonify({"hata": "geçersiz proje verisi"}), 400

    with baglan() as conn, conn:
        conn.execute(
            "INSERT OR REPLACE INTO projeler (id, name, created_at, data) VALUES (?, ?, ?, ?)",
            (proje["id"], proje.get("name", ""), proje.get("createdAt", ""), json.dumps(proje))
        )

    return jsonify({"durum": "kaydedildi"})


@app.route("/api/projeler/<proje_id>", methods=["DELETE"])
def proje_sil(proje_id):
    if not ID_DESENI.match(proje_id):
        return jsonify({"hata": "geçersiz proje id'si"}), 400

    with baglan() as conn, conn:
        conn.execute("DELETE FROM projeler WHERE id = ?", (proje_id,))

    return jsonify({"durum": "silindi"})


if __name__ == "__main__":
    # Debug modu (Werkzeug konsolu kod çalıştırabilir) sadece ENCORE_DEBUG=1 ile açılır.
    app.run(host="127.0.0.1", port=5001, debug=os.environ.get("ENCORE_DEBUG") == "1")
