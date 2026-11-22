"""API ve güvenlik kontrolleri. Çalıştırma: python test_app.py"""
import os
import tempfile

import app

app.DB = os.path.join(tempfile.mkdtemp(), "test.db")  # gerçek encore.db'ye dokunma
app.db_hazirla()
c = app.app.test_client()

proje = {"id": "job_1700000000000_ab12c", "name": "Test", "createdAt": "2026-01-01",
         "production": {"Teknik Ekipman": [{"kalem": "Truss", "fiyat": 10}], "Animasyon": []}}

# Normal akış: kaydet, sırası korunarak listele, sil
assert c.post("/api/projeler", json=proje).status_code == 200
liste = c.get("/api/projeler").get_json()
assert list(liste[0]["production"]) == ["Teknik Ekipman", "Animasyon"]
assert c.delete("/api/projeler/" + proje["id"]).status_code == 200
assert c.get("/api/projeler").get_json() == []

# Geçersiz veriler reddedilir
for kotu in [
    {},
    {**proje, "id": "x'); alert(1);//"},
    {**proje, "production": {"__proto__": []}},
    {**proje, "personnel": "liste değil"},
    {**proje, "name": "a" * 6000},
    {**proje, "production": {"A": [{"a": {"b": {"c": {"d": 1}}}}]}},
]:
    assert c.post("/api/projeler", json=kotu).status_code == 400, kotu
assert c.post("/api/projeler", data="{}", content_type="text/plain").status_code == 400
assert c.post("/api/projeler", data="x" * (2 * 1024 * 1024), content_type="application/json").status_code == 413
assert c.delete("/api/projeler/bad'id").status_code == 400

# Başka siteden gelen istek ve yabancı Host reddedilir
assert c.post("/api/projeler", json=proje, headers={"Sec-Fetch-Site": "cross-site"}).status_code == 403
assert c.get("/api/projeler", headers={"Host": "evil.example"}).status_code == 400

# Güvenlik başlıkları
h = c.get("/").headers
assert "frame-ancestors 'none'" in h["Content-Security-Policy"]
assert h["X-Content-Type-Options"] == "nosniff"

print("Tüm testler geçti.")
