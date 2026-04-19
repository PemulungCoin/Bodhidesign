#!/usr/bin/env python3
"""Interior Design Academy — Flask + SQLite + Admin Panel + Chatbot"""

import os
import sqlite3
import uuid
import json
from datetime import datetime
from functools import wraps

from flask import (
    Flask, render_template, request, redirect, url_for,
    session, jsonify, flash
)
from werkzeug.utils import secure_filename

# ─── Config ───────────────────────────────────────────────────────────
app = Flask(__name__)
app.secret_key = "interior-academy-2026-secret"
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "db", "academy.db")
UPLOAD_DIR = os.path.join(BASE_DIR, "static", "uploads")
ADMIN_PASS = "desain2026"
ALLOWED_EXT = {"png", "jpg", "jpeg", "gif", "webp", "svg"}

os.makedirs(UPLOAD_DIR, exist_ok=True)

# ─── Database ─────────────────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def init_db():
    conn = get_db()
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL, description TEXT DEFAULT '',
        duration TEXT DEFAULT '', price TEXT DEFAULT '',
        icon TEXT DEFAULT '🎨', image TEXT DEFAULT '',
        features TEXT DEFAULT '[]', is_featured INTEGER DEFAULT 0, sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS modules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id INTEGER DEFAULT 0, title TEXT NOT NULL,
        description TEXT DEFAULT '', duration TEXT DEFAULT '',
        sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS instructors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL, title TEXT DEFAULT '',
        bio TEXT DEFAULT '', achievements TEXT DEFAULT '[]',
        image TEXT DEFAULT '', linkedin TEXT DEFAULT '',
        sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS testimonials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL, role TEXT DEFAULT '',
        text TEXT DEFAULT '', rating INTEGER DEFAULT 5,
        image TEXT DEFAULT '', sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS faq (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question TEXT NOT NULL, answer TEXT DEFAULT '',
        sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS audience (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL, description TEXT DEFAULT '',
        icon TEXT DEFAULT '👤', sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS portfolio (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL, description TEXT DEFAULT '',
        image TEXT DEFAULT '', sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL DEFAULT 'general',
        filename TEXT NOT NULL, original_name TEXT DEFAULT '',
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS chatbot_responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        keywords TEXT NOT NULL, response TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL, phone TEXT DEFAULT '',
        email TEXT DEFAULT '', message TEXT DEFAULT '',
        source TEXT DEFAULT 'website',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)
    conn.commit()
    if conn.execute("SELECT COUNT(*) FROM settings").fetchone()[0] == 0:
        seed_data(conn)
    conn.close()

def seed_data(conn):
    c = conn.cursor()

    settings = {
        "site_title": "BODHI Creative + Design",
        "site_subtitle": "Wadah Pendidikan Interior Designer Profesional",
        "hero_title": "Interior Designer\nProfesional",
        "hero_subtitle": "Sebuah studi yang dirancang kurikulum praktis secara sistematis yang dinamis cara belajar/berlatih dalam pelaksanaannya. Proses menjadi predikat seorang DESIGNER INTERIOR secara singkat, jelas dan padat dengan kepastian menjadi seorang designer interior profesional.",
        "hero_cta": "Daftar Sekarang",
        "hero_badge": "Pendidikan Profesional • Sejak 2011",
        "whatsapp_link": "https://wa.me/628xxxxxxxxxx",
        "whatsapp_number": "628xxxxxxxxxx",
        "email": "info@bodhicreative.com",
        "phone": "—",
        "address": "Jln. Pelita I No.74D, Kel. Sidorame Timur, Kec. Medan Perjuangan, Kota Medan, Sumatera Utara, 20233",
        "footer_about": "BODHI Creative + Design adalah wadah pendidikan yang lahir dari gagasan kuat dengan pertimbangan hasil riset secara real suatu pendidikan maupun kebutuhan tenaga kreatif serta tuntutan dunia design. Didirikan oleh Jamry, S.T., M.Psi — praktisi professional sejak 1999.",
        "hero_stat_students": "100+",
        "hero_stat_rating": "4.9/5",
        "hero_stat_practice": "90%",
        "hero_stat_projects": "50+",
        "promo_text": "Daftar sekarang dan buktikan langsung!",
        "promo_slots": "50",
        "theme": "v1",
        "chatbot_welcome": "Halo! 👋 Selamat datang di BODHI Creative + Design. Wadah pendidikan Interior Designer Profesional sejak 2011. Ada yang bisa saya bantu?",
        "chatbot_whatsapp_fallback": "Terima kasih atas pertanyaannya! Untuk info lebih lanjut, silakan hubungi kami via WhatsApp ya 😊",
        "visi": "Profesi AHLI yang lahir dari KREATIFITAS sejalan dengan Teknologi dan Perubahan",
        "misi": "Mempersiapkan dan menjadikan PROFESI seorang Profesional Designer secara Singkat melalui cara-cara yang tepat, penuh kepastian Bersama tenaga ahli dalam mengajar dan melatih di bidang profesinya berskala dekade lamanya.",
        "founder_name": "Jamry, S.T., M.Psi",
        "founder_title": "Arsitek & Praktisi Psikologi — Pendiri BODHI Creative + Design",
        "ig_handle": "@bodhicreative",
    }
    for k, v in settings.items():
        c.execute("INSERT INTO settings (key, value) VALUES (?, ?)", (k, v))

    # Audience — sesuai dokumen BODHI
    audiences = [
        ("Pemula Tanpa Pengalaman", "Seorang pemula atau mahasiswa/I segala jurusan dan profesi dapat menjadikan profesi diandalkan dalam menjadikan BISNIS secara cepat berskala mahir dalam menciptakan karya-karya design untuk bersaing di pasar global.", "🌱"),
        ("Ingin Ganti Karier?", "Mampu membuka peluang besar di dunia BISNIS Kreatif tanpa harus bertahun lamanya untuk belajar. Datang dan Buktikan Langsung!", "🔄"),
        ("Pelajar SMA/SMK/SLTA", "Untuk pelajar SMU/SMK/SLTA persiapan portfolio calon mahasiswa baru untuk persiapan kuliah keluar negeri dengan target mendapatkan beasiswa perkuliahan.", "🎓"),
        ("Arsitek & Profesional", "Pengalaman praktisi professional dalam menangani proyek desain. Mengerti dalam membuat materi dan melayani semua tipe manusia sebagai pembelajar.", "🏗️"),
        ("Pecinta Desain & Kreativitas", "Sudah sejak 2011 dengan ratusan peserta didik yang berhasil membidangi profesi ini maupun yang sudah melanjutkan pendidikan ke luar negri.", "🏡"),
    ]
    for i, (t, d, ic) in enumerate(audiences, 1):
        c.execute("INSERT INTO audience (title, description, icon, sort_order) VALUES (?,?,?,?)", (t, d, ic, i))

    # Instructor — Pendiri BODHI
    instructors = [
        ("Jamry, S.T., M.Psi", "Arsitek & Praktisi Psikologi — Pendiri BODHI Creative + Design",
         "Alumni Arsitektur Institute Sains & Teknologi TD.Pardede Medan tahun 1999 dan Magister Psikologi Industri dan Organisasi dengan focus konsentrasi riset ilmu design terhadap perkembangan prilaku manusia beserta pengaruhnya terhadap bisnis. Dikenal sebagai Arsitek dan praktisi psikologi membidangi Konsultan Perencana dan Kontraktor Building sejak 1999, Founder Intrash-design di bidang karya Daur ulang Upcycling untuk produk design. Sudah ratusan peserta yang selesai berkarir menjadi designer sejak 2011. Saat ini juga sebagai pengajar Dosen Arsitektur Institute Modern of Architecture and Technology di Medan.",
         '["Arsitektur IST TD.Pardede Medan 1999","Magister Psikologi Industri & Organisasi","Konsultan Perencana & Kontraktor sejak 1999","Founder Intrash-design (Upcycling)","Ratusan peserta berhasil sejak 2011","Dosen Arsitektur IMAT Medan","Delegate APSDA 2014 Solo Yogyakarta","Koordinator PSDM HDII Sumut 2014-2016","Presiden Lions Club Medan Premier 2021-2022","Ketua Daerah VIII Lions Club Distrik 307A2 2022-2023","Alumni FDI Peninsula Jakarta 2023","Alumni Regional LLI Santika Medan 2023"]',
         "", "", 1),
    ]
    for n, t, b, a, img, li, o in instructors:
        c.execute("INSERT INTO instructors (name, title, bio, achievements, image, linkedin, sort_order) VALUES (?,?,?,?,?,?,?)",
                  (n, t, b, a, img, li, o))

    # Courses — sesuai program BODHI
    courses = [
        ("Profesional Eksklusif", "Program studi 50 pertemuan yang dirancang kurikulum praktis secara sistematis. Studio perancangan, aplikasi komputer (AutoCAD 2D, SketchUp + 3Max 3D, Enscape Rendering), studio konstruksi & furniture, serta workshop produksi gambar kerja ke konstruksi interior.", "50 Pertemuan", "Hubungi Kami", "🏠",
         '["Studio Perancangan Design","Studio Aplikasi Komputer","AutoCAD 2 Dimensi","SketchUp + 3Max 3 Dimensi","Enscape Rendering","Proses Perancangan Project","Studio Konstruksi & Furniture","Workshop Gambar Kerja","Praktek Kerja Lapangan (PKL)","Project Tugas Akhir","Program Pendampingan Proyek"]', 1, 1),
        ("Program Arsitektur Interior", "Khusus SMU/SMK/SLTA — 2x pertemuan seminggu. Membangun dasar kuat untuk melanjutkan ke perguruan tinggi atau meraih beasiswa di luar negeri melalui portfolio profesional.", "2x Seminggu", "Hubungi Kami", "🎓",
         '["Pengantar & Motivasi Profesi","Menggambar Teknik","Bentuk dan Ruang","Dwimatra dan Trimatra","Design Thinking for Designer","Pengembangan Minat dan Bakat","Mural Art Design","Trend Daur Ulang dalam Design","Psikologi Design & Penerapan","Studio Aplikasi 2D & 3D"]', 0, 2),
    ]
    for t, d, dur, p, ic, ft, feat, o in courses:
        c.execute("INSERT INTO courses (title, description, duration, price, icon, features, is_featured, sort_order) VALUES (?,?,?,?,?,?,?,?)",
                  (t, d, dur, p, ic, ft, feat, o))

    # Modules — Kurikulum Profesional Eksklusif (course_id 1)
    modules = [
        (1, "Dasar-Dasar Pemodelan/Bentuk", "Pengetahuan dan pelatihan dasar sumber seluruh konsep bentuk dan model dalam menghasilkan satu bentuk hingga menjadi suatu fungsi secara mudah diterapkan pada perancangan.", "Materi 1", 1),
        (1, "Konsep Cepat Design Kreatif", "Teknik mengarahkan dalam menerjemahkan tujuan penggambaran secara menarik yang sederhana tetapi mencakup keseluruhan dan menjawab semua kebutuhan yang bersifat realistis.", "Materi 2", 2),
        (1, "Strategi Perencanaan Design", "Langkah/tahapan yang sistematis serta dapat dilaksanakan/diterapkan dengan mudah dan menarik, tanpa harus melalui plagiat/mengambil karya orang lain.", "Materi 3", 3),
        (1, "Trend Daur Ulang dalam Design", "Penempatan produk karya design melalui produk daur ulang menjadi trend topik di era globalisasi pada industry kreatif design yang memiliki nilai jual tinggi.", "Materi 4", 4),
        (1, "Design Thinking for Designer", "Pengetahuan dan ilmu psikologi melalui penerapan teori maupun non teori tentang manusia terhadap sebuah karya, baik sebelum ataupun sesudah dimulainya produksi.", "Materi 5", 5),
        (1, "Teknik Marketing Design & Problem Solving", "Menjual/memasarkan sebuah karya bukan sekedar estetika dan fungsi. Seorang designer harus mampu menjawab semua pertanyaan dan menerjemahkan hasil diskusi yang mampu meyakinkan owner.", "Materi 6", 6),
        (1, "Membangun Bisnis Konstruksi Design", "Setiap peserta didik harus mampu membangun dan menjadikan bisnis dunia design sebagai harapan, baik itu secara Konsultan maupun Kontraktor.", "Materi 7", 7),
        (1, "Praktek Kerja Lapangan (PKL)", "Peserta belajar wajib memahami penerapan semua yang sudah dikonsep melalui pengamatan hingga mengetahui secara terperinci teknik pelaksanaan di lapangan.", "Materi 8", 8),
        (1, "Project Tugas Akhir", "Membuat karya project design dari mulai konsep ide sampai menjadikan portofolio realistis, tidak sekedar nilai akademis saja.", "Materi 9", 9),
        (1, "Program Pendampingan Proyek Design", "Nilai tambah setelah selesai program — para peserta mendapat konsultasi baik secara design maupun pelaksanaan project hingga bermitra kontraktor.", "Materi 10", 10),
    ]
    for cid, t, d, dur, o in modules:
        c.execute("INSERT INTO modules (course_id, title, description, duration, sort_order) VALUES (?,?,?,?,?)", (cid, t, d, dur, o))

    # Testimonials
    testimonials = [
        ("Alumni 2015", "Lulusan Profesional Eksklusif", "Belajar di BODHI sangat berbeda. Praktisi langsung yang mengajar, bukan hanya teori. Sekarang saya sudah punya bisnis kontraktor interior sendiri.", 5, "", 1),
        ("Alumni 2018", "Lulusan Program SMA", "Dari SMA langsung dibimbing bikin portfolio. Alhasil berhasil dapat beasiswa kuliah arsitektur di luar negeri. Terima kasih Pak Jamry!", 5, "", 2),
        ("Alumni 2020", "Lulusan Profesional Eksklusif", "Materinya padat dan langsung praktik. Dari AutoCAD sampai Enscape diajarkan tuntas. Dalam 3 bulan sudah bisa ambil proyek pertama.", 5, "", 3),
    ]
    for n, r, t, ra, img, o in testimonials:
        c.execute("INSERT INTO testimonials (name, role, text, rating, image, sort_order) VALUES (?,?,?,?,?,?)", (n, r, t, ra, img, o))

    # FAQ
    faqs = [
        ("Apakah kursus ini untuk pemula?", "Ya! Seorang pemula atau mahasiswa/I segala jurusan dan profesi dapat mengikuti program ini. Yang penting ada kemauan belajar dan kreativitas."),
        ("Berapa lama program Profesional Eksklusif?", "Program Profesional Eksklusif terdiri dari 50 pertemuan. Seminggu 2-3 kali pertemuan, Senin–Sabtu, online dan offline."),
        ("Apakah ada program untuk pelajar SMA?", "Ya, ada Program Arsitektur Interior khusus SMU/SMK/SLTA dengan 2x pertemuan seminggu. Bertujuan membangun portfolio untuk persiapan kuliah dan beasiswa luar negeri."),
        ("Software apa yang digunakan?", "AutoCAD 2 Dimensi, SketchUp + 3Max 3 Dimensi, dan Enscape Rendering — semua software industry standard untuk desain interior."),
        ("Apa saja yang dipelajari?", "Dasar pemodelan, konsep design kreatif, strategi perencanaan, trend daur ulang, design thinking, marketing design, bisnis konstruksi, PKL, hingga project tugas akhir."),
        ("Apakah ada sertifikat?", "Ya, setiap peserta yang menyelesaikan program dan project tugas akhir akan mendapat sertifikat dari BODHI Creative + Design."),
        ("Bagaimana jadwal belajarnya?", "Seminggu 2-3 kali pertemuan, Senin–Sabtu. Tersedia sesi pukul 15.00–16.30 WIB dan 18.00–19.30 WIB. Online dan Offline."),
        ("Apakah ada pendampingan setelah lulus?", "Ya! Program Pendampingan Proyek Design — peserta mendapat konsultasi design maupun pelaksanaan project hingga bermitra kontraktor dalam pencapaian bisnis dan karir."),
        ("Apakah ada kegiatan ekstrakurikuler?", "Ya, ada Clinic Arsitektur & Design (diskusi ilmiah dan konsultasi design ke masyarakat) serta Galleria (foto studi literatur, studi banding, seminar, dan kunjungan proyek)."),
    ]
    for o, (q, a) in enumerate(faqs, 1):
        c.execute("INSERT INTO faq (question, answer, sort_order) VALUES (?,?,?)", (q, a, o))

    # Chatbot responses
    chatbot = [
        ("harga|biaya|tarif|berapa|price|biayanya", "Untuk informasi biaya program Profesional Eksklusif (50 pertemuan) dan Program Arsitektur Interior, silakan hubungi kami langsung via WhatsApp untuk mendapatkan penawaran terbaik! 📱"),
        ("daftar|registrasi|gabung|ikutan|join|pendaftaran", "Untuk mendaftar, silakan hubungi kami via WhatsApp atau datang langsung ke Jln. Pelita I No.74D, Medan. Tim kami akan bantu proses pendaftaran! 📱"),
        ("jadwal|schedule|waktu|kapan", "Program Profesional Eksklusif: seminggu 2-3x, Senin–Sabtu, pukul 15.00–16.30 atau 18.00–19.30 WIB. Program SMA: 2x seminggu. Tersedia online dan offline. 📅"),
        ("sertifikat|certificate|ijazah", "Ya! Setiap peserta yang menyelesaikan program dan project tugas akhir mendapat sertifikat dari BODHI Creative + Design. 🎓"),
        ("lama|durasi|berapa|how long|pertemuan", "Program Profesional Eksklusif: 50 pertemuan. Program Arsitektur Interior (SMA): 2x seminggu. Semua fleksibel Senin–Sabtu. ⏱️"),
        ("software|aplikasi|tool|autocad|sketchup|enscape", "Kami menggunakan AutoCAD 2D, SketchUp + 3Max 3D, dan Enscape Rendering — software industry standard untuk interior design profesional. 💻"),
        ("pemula|baru|nggak bisa|nol|beginner", "Program ini 100% cocok untuk pemula! Dari dasar pemodelan hingga project tugas akhir. Mentornya praktisi professional sejak 1999. 🌱"),
        ("sma|smk|slta|pelajar", "Ada Program Arsitektur Interior khusus SMU/SMK/SLTA! 2x pertemuan seminggu, bertujuan membangun portfolio untuk persiapan kuliah dan beasiswa luar negeri. 🎓"),
        ("portofolio|portfolio|hasil karya", "Setiap peserta akan membuat karya project design dari konsep ide hingga portofolio realistis. Plus ada PKL dan program pendampingan proyek! 🖼️"),
        ("pendiri|pengajar|mentor|jamry", "BODHI didirikan oleh Jamry, S.T., M.Psi — Arsitek & praktisi psikologi, konsultan perencana sejak 1999, dosen Arsitektur IMAT Medan. Berpengalaman lebih dari 25 tahun! 👨‍🏫"),
        ("alamat|lokasi|dimana|medan", "Kami di Jln. Pelita I No.74D, Kel. Sidorame Timur, Kec. Medan Perjuangan, Kota Medan, Sumatera Utara, 20233. Tersedia juga kelas online! 📍"),
        ("ekskul|ekstrakurikuler|clinic|galleria", "Ada Clinic Arsitektur & Design (diskusi ilmiah & konsultasi design ke masyarakat) dan Galleria (studi literatur, studi banding, seminar, kunjungan proyek). 🎨"),
    ]
    for o, (kw, resp) in enumerate(chatbot, 1):
        c.execute("INSERT INTO chatbot_responses (keywords, response, sort_order) VALUES (?,?,?)", (kw, resp, o))

    # Portfolio
    portfolios = [
        ("Studio Perancangan", "Proses perancangan project design dari konsep hingga realisasi", ""),
        ("Aplikasi Komputer", "AutoCAD 2D, SketchUp + 3Max 3D, Enscape Rendering", ""),
        ("Konstruksi & Furniture", "Workshop produksi gambar kerja ke konstruksi interior", ""),
        ("Daur Ulang Upcycling", "Produk design dari bahan daur ulang dengan nilai jual tinggi", ""),
        ("Project Tugas Akhir", "Karya project design dari konsep ide hingga portofolio realistis", ""),
        ("PKL & Kunjungan Proyek", "Praktek kerja lapangan dibimbing professional konsultan & kontraktor", ""),
    ]
    for o, (t, d, img) in enumerate(portfolios, 1):
        c.execute("INSERT INTO portfolio (title, description, image, sort_order) VALUES (?,?,?,?)", (t, d, img, o))

    conn.commit()

# ─── Auth ─────────────────────────────────────────────────────────────
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("logged_in"):
            return redirect(url_for("admin_login"))
        return f(*args, **kwargs)
    return decorated

# ─── Helpers ──────────────────────────────────────────────────────────
def get_all_settings():
    conn = get_db()
    rows = conn.execute("SELECT key, value FROM settings").fetchall()
    conn.close()
    return {r["key"]: r["value"] for r in rows}

def get_images_by_category():
    conn = get_db()
    rows = conn.execute("SELECT * FROM images ORDER BY category, sort_order, id DESC").fetchall()
    conn.close()
    imgs = {}
    for r in rows:
        imgs.setdefault(r["category"], []).append(dict(r))
    return imgs

# ─── Public Routes ────────────────────────────────────────────────────
@app.route("/")
def index():
    s = get_all_settings()
    conn = get_db()
    courses = [dict(r) for r in conn.execute("SELECT * FROM courses ORDER BY sort_order").fetchall()]
    modules = [dict(r) for r in conn.execute("SELECT * FROM modules ORDER BY sort_order").fetchall()]
    instructors = [dict(r) for r in conn.execute("SELECT * FROM instructors ORDER BY sort_order").fetchall()]
    testimonials = [dict(r) for r in conn.execute("SELECT * FROM testimonials ORDER BY sort_order").fetchall()]
    faqs = [dict(r) for r in conn.execute("SELECT * FROM faq ORDER BY sort_order").fetchall()]
    audiences = [dict(r) for r in conn.execute("SELECT * FROM audience ORDER BY sort_order").fetchall()]
    portfolios = [dict(r) for r in conn.execute("SELECT * FROM portfolio ORDER BY sort_order").fetchall()]
    conn.close()
    images = get_images_by_category()

    # Parse JSON fields
    for c in courses:
        try: c["features"] = json.loads(c["features"])
        except: c["features"] = []
    for inst in instructors:
        try: inst["achievements"] = json.loads(inst["achievements"])
        except: inst["achievements"] = []

    # Theme: query param overrides settings
    theme = request.args.get("theme") or s.get("theme", "v1")
    tpl = "index_v2.html" if theme == "v2" else "index.html"
    editor_mode = request.args.get("edit") == "1"

    # Load saved layout data
    layout_file = os.path.join(BASE_DIR, "db", "editor_layouts.json")
    layout_data = {}
    if os.path.exists(layout_file):
        with open(layout_file) as f:
            layout_data = json.load(f)

    # Load CSS editor rules
    css_rules_file = os.path.join(BASE_DIR, "db", "editor_css_rules.json")
    css_rules = []
    if os.path.exists(css_rules_file):
        with open(css_rules_file) as f:
            css_rules = json.load(f)

    return render_template(tpl, s=s, courses=courses, modules=modules,
                           instructors=instructors, testimonials=testimonials,
                           faqs=faqs, audiences=audiences, portfolios=portfolios,
                           images=images, layout_data=json.dumps(layout_data),
                           editor_mode=editor_mode, css_rules=json.dumps(css_rules))

@app.route("/v2")
def index_v2():
    s = get_all_settings()
    conn = get_db()
    courses = [dict(r) for r in conn.execute("SELECT * FROM courses ORDER BY sort_order").fetchall()]
    modules = [dict(r) for r in conn.execute("SELECT * FROM modules ORDER BY sort_order").fetchall()]
    instructors = [dict(r) for r in conn.execute("SELECT * FROM instructors ORDER BY sort_order").fetchall()]
    testimonials = [dict(r) for r in conn.execute("SELECT * FROM testimonials ORDER BY sort_order").fetchall()]
    faqs = [dict(r) for r in conn.execute("SELECT * FROM faq ORDER BY sort_order").fetchall()]
    audiences = [dict(r) for r in conn.execute("SELECT * FROM audience ORDER BY sort_order").fetchall()]
    portfolios = [dict(r) for r in conn.execute("SELECT * FROM portfolio ORDER BY sort_order").fetchall()]
    conn.close()
    images = get_images_by_category()
    for c in courses:
        try: c["features"] = json.loads(c["features"])
        except: c["features"] = []
    for inst in instructors:
        try: inst["achievements"] = json.loads(inst["achievements"])
        except: inst["achievements"] = []
    # Load CSS editor rules
    css_rules_file = os.path.join(BASE_DIR, "db", "editor_css_rules.json")
    css_rules = []
    if os.path.exists(css_rules_file):
        with open(css_rules_file) as f:
            css_rules = json.load(f)

    return render_template("index_v2.html", s=s, courses=courses, modules=modules,
                           instructors=instructors, testimonials=testimonials,
                           faqs=faqs, audiences=audiences, portfolios=portfolios,
                           images=images, css_rules=json.dumps(css_rules))

# ─── Chatbot API ──────────────────────────────────────────────────────
@app.route("/api/chat", methods=["POST"])
def api_chat():
    msg = request.json.get("message", "").lower().strip()
    conn = get_db()
    responses = conn.execute("SELECT keywords, response FROM chatbot_responses ORDER BY sort_order").fetchall()
    conn.close()

    for row in responses:
        keywords = row["keywords"].split("|")
        for kw in keywords:
            if kw.strip() in msg:
                return jsonify({"reply": row["response"], "fallback": False})

    s = get_all_settings()
    return jsonify({
        "reply": s.get("chatbot_whatsapp_fallback", "Terima kasih! Tim kami akan segera merespons."),
        "fallback": True,
        "whatsapp_link": s.get("whatsapp_link", "#")
    })

@app.route("/api/lead", methods=["POST"])
def api_lead():
    data = request.json or request.form
    conn = get_db()
    conn.execute("INSERT INTO leads (name, phone, email, message) VALUES (?,?,?,?)",
                 (data.get("name", ""), data.get("phone", ""),
                  data.get("email", ""), data.get("message", "")))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "Terima kasih! Kami akan segera menghubungi Anda."})

# ─── Admin Routes ─────────────────────────────────────────────────────
@app.route("/admin", methods=["GET", "POST"])
def admin_login():
    if request.method == "POST":
        pw = request.form.get("password", "")
        if pw == ADMIN_PASS:
            session["logged_in"] = True
            return redirect(url_for("admin_dashboard"))
        flash("Password salah!", "error")
    return render_template("admin_login.html")

@app.route("/admin/logout")
def admin_logout():
    session.pop("logged_in", None)
    return redirect(url_for("admin_login"))

@app.route("/admin/dashboard")
@login_required
def admin_dashboard():
    conn = get_db()
    stats = {
        "courses": conn.execute("SELECT COUNT(*) FROM courses").fetchone()[0],
        "modules": conn.execute("SELECT COUNT(*) FROM modules").fetchone()[0],
        "instructors": conn.execute("SELECT COUNT(*) FROM instructors").fetchone()[0],
        "testimonials": conn.execute("SELECT COUNT(*) FROM testimonials").fetchone()[0],
        "faq": conn.execute("SELECT COUNT(*) FROM faq").fetchone()[0],
        "audience": conn.execute("SELECT COUNT(*) FROM audience").fetchone()[0],
        "images": conn.execute("SELECT COUNT(*) FROM images").fetchone()[0],
        "leads": conn.execute("SELECT COUNT(*) FROM leads").fetchone()[0],
        "chatbot": conn.execute("SELECT COUNT(*) FROM chatbot_responses").fetchone()[0],
    }
    recent_leads = [dict(r) for r in conn.execute("SELECT * FROM leads ORDER BY id DESC LIMIT 5").fetchall()]
    conn.close()
    return render_template("admin_dashboard.html", stats=stats, s=get_all_settings(), recent_leads=recent_leads)

# --- Settings ---
@app.route("/admin/settings", methods=["GET", "POST"])
@login_required
def admin_settings():
    if request.method == "POST":
        # Handle logo upload
        logo_file = request.files.get("logo_file")
        if logo_file and logo_file.filename:
            ext = logo_file.filename.rsplit(".", 1)[-1].lower()
            if ext in ALLOWED_EXT:
                logo_dir = os.path.join(UPLOAD_DIR, "logos")
                os.makedirs(logo_dir, exist_ok=True)
                # Remove old logo files
                for old in os.listdir(logo_dir):
                    os.remove(os.path.join(logo_dir, old))
                fname = f"logo.{ext}"
                logo_file.save(os.path.join(logo_dir, fname))
                conn = get_db()
                conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('logo', ?)", (fname,))
                conn.commit()
                conn.close()
                flash("Logo berhasil diupload!", "success")
        # Handle favicon upload
        favicon_file = request.files.get("favicon_file")
        if favicon_file and favicon_file.filename:
            ext = favicon_file.filename.rsplit(".", 1)[-1].lower()
            if ext in ALLOWED_EXT:
                logo_dir = os.path.join(UPLOAD_DIR, "logos")
                os.makedirs(logo_dir, exist_ok=True)
                fname = f"favicon.{ext}"
                favicon_file.save(os.path.join(logo_dir, fname))
                conn = get_db()
                conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('favicon', ?)", (fname,))
                conn.commit()
                conn.close()
                flash("Favicon berhasil diupload!", "success")
        # Handle regular settings
        conn = get_db()
        c = conn.cursor()
        for key, value in request.form.items():
            if key.startswith("setting_"):
                sk = key.replace("setting_", "")
                c.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (sk, value))
        conn.commit()
        conn.close()
        if not logo_file and not favicon_file:
            flash("Settings disimpan!", "success")
    s = get_all_settings()
    return render_template("admin_settings.html", settings=s, s=s)

@app.route("/set-theme/<theme>")
@login_required
def set_theme(theme):
    if theme not in ("v1", "v2"): theme = "v1"
    conn = get_db()
    conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('theme', ?)", (theme,))
    conn.commit()
    conn.close()
    flash(f"Theme diubah ke {theme.upper()}", "success")
    return redirect(url_for("admin_settings"))

# --- Courses ---
@app.route("/admin/courses", methods=["GET", "POST"])
@login_required
def admin_courses():
    conn = get_db()
    c = conn.cursor()
    if request.method == "POST":
        action = request.form.get("action")
        # Handle image upload
        img_file = request.files.get("image_file")
        img_filename = ""
        if img_file and img_file.filename:
            ext = img_file.filename.rsplit(".", 1)[-1].lower()
            if ext in ALLOWED_EXT:
                img_dir = os.path.join(UPLOAD_DIR, "courses")
                os.makedirs(img_dir, exist_ok=True)
                fname = f"{uuid.uuid4().hex[:12]}.{ext}"
                img_file.save(os.path.join(img_dir, fname))
                img_filename = fname
        if action == "add":
            c.execute("INSERT INTO courses (title, description, duration, price, icon, image, features, is_featured, sort_order) VALUES (?,?,?,?,?,?,?,?,?)",
                      (request.form["title"], request.form.get("description", ""),
                       request.form.get("duration", ""), request.form.get("price", ""),
                       request.form.get("icon", "🎨"), img_filename,
                       request.form.get("features", "[]"),
                       1 if request.form.get("is_featured") else 0, 0))
            flash("Kursus ditambahkan!", "success")
        elif action == "edit":
            img_val = img_filename if img_filename else request.form.get("image", "")
            c.execute("UPDATE courses SET title=?, description=?, duration=?, price=?, icon=?, image=?, features=?, is_featured=? WHERE id=?",
                      (request.form["title"], request.form.get("description", ""),
                       request.form.get("duration", ""), request.form.get("price", ""),
                       request.form.get("icon", "🎨"), img_val,
                       request.form.get("features", "[]"),
                       1 if request.form.get("is_featured") else 0, request.form["id"]))
            flash("Kursus diupdate!", "success")
        conn.commit()
    if request.args.get("delete"):
        c.execute("DELETE FROM courses WHERE id=?", (request.args["delete"],))
        conn.commit()
        flash("Kursus dihapus!", "success")
        return redirect(url_for("admin_courses"))
    courses = [dict(r) for r in conn.execute("SELECT * FROM courses ORDER BY sort_order").fetchall()]
    conn.close()
    return render_template("admin_courses.html", courses=courses, s=get_all_settings())

# --- Modules ---
@app.route("/admin/modules", methods=["GET", "POST"])
@login_required
def admin_modules():
    conn = get_db()
    c = conn.cursor()
    if request.method == "POST":
        action = request.form.get("action")
        if action == "add":
            c.execute("INSERT INTO modules (course_id, title, description, duration, sort_order) VALUES (?,?,?,?,?)",
                      (request.form.get("course_id", 0), request.form["title"],
                       request.form.get("description", ""), request.form.get("duration", ""), 0))
            flash("Modul ditambahkan!", "success")
        elif action == "edit":
            c.execute("UPDATE modules SET course_id=?, title=?, description=?, duration=? WHERE id=?",
                      (request.form.get("course_id", 0), request.form["title"],
                       request.form.get("description", ""), request.form.get("duration", ""),
                       request.form["id"]))
            flash("Modul diupdate!", "success")
        conn.commit()
    if request.args.get("delete"):
        c.execute("DELETE FROM modules WHERE id=?", (request.args["delete"],))
        conn.commit()
        flash("Modul dihapus!", "success")
        return redirect(url_for("admin_modules"))
    modules = [dict(r) for r in conn.execute("SELECT * FROM modules ORDER BY course_id, sort_order").fetchall()]
    courses = [dict(r) for r in conn.execute("SELECT id, title FROM courses ORDER BY sort_order").fetchall()]
    conn.close()
    return render_template("admin_modules.html", modules=modules, courses=courses, s=get_all_settings())

# --- Instructors ---
@app.route("/admin/instructors", methods=["GET", "POST"])
@login_required
def admin_instructors():
    conn = get_db()
    c = conn.cursor()
    if request.method == "POST":
        action = request.form.get("action")
        # Handle photo upload
        photo_file = request.files.get("photo_file")
        photo_filename = ""
        if photo_file and photo_file.filename:
            ext = photo_file.filename.rsplit(".", 1)[-1].lower()
            if ext in ALLOWED_EXT:
                photo_dir = os.path.join(UPLOAD_DIR, "instructors")
                os.makedirs(photo_dir, exist_ok=True)
                fname = f"{uuid.uuid4().hex[:12]}.{ext}"
                photo_file.save(os.path.join(photo_dir, fname))
                photo_filename = fname
        if action == "add":
            c.execute("INSERT INTO instructors (name, title, bio, achievements, image, linkedin, sort_order) VALUES (?,?,?,?,?,?,?)",
                      (request.form["name"], request.form.get("title", ""),
                       request.form.get("bio", ""), request.form.get("achievements", "[]"),
                       photo_filename or request.form.get("image", ""), request.form.get("linkedin", ""), 0))
            flash("Pengajar ditambahkan!", "success")
        elif action == "edit":
            img_val = photo_filename if photo_filename else request.form.get("image", "")
            c.execute("UPDATE instructors SET name=?, title=?, bio=?, achievements=?, image=?, linkedin=? WHERE id=?",
                      (request.form["name"], request.form.get("title", ""),
                       request.form.get("bio", ""), request.form.get("achievements", "[]"),
                       img_val, request.form.get("linkedin", ""),
                       request.form["id"]))
            flash("Pengajar diupdate!", "success")
        conn.commit()
    if request.args.get("delete"):
        c.execute("DELETE FROM instructors WHERE id=?", (request.args["delete"],))
        conn.commit()
        flash("Pengajar dihapus!", "success")
        return redirect(url_for("admin_instructors"))
    instructors = [dict(r) for r in conn.execute("SELECT * FROM instructors ORDER BY sort_order").fetchall()]
    conn.close()
    return render_template("admin_instructors.html", instructors=instructors, s=get_all_settings())

# --- Audience ---
@app.route("/admin/audience", methods=["GET", "POST"])
@login_required
def admin_audience():
    conn = get_db()
    c = conn.cursor()
    if request.method == "POST":
        action = request.form.get("action")
        if action == "add":
            c.execute("INSERT INTO audience (title, description, icon, sort_order) VALUES (?,?,?,?)",
                      (request.form["title"], request.form.get("description", ""),
                       request.form.get("icon", "👤"), 0))
            flash("Target audience ditambahkan!", "success")
        elif action == "edit":
            c.execute("UPDATE audience SET title=?, description=?, icon=? WHERE id=?",
                      (request.form["title"], request.form.get("description", ""),
                       request.form.get("icon", "👤"), request.form["id"]))
            flash("Target audience diupdate!", "success")
        conn.commit()
    if request.args.get("delete"):
        c.execute("DELETE FROM audience WHERE id=?", (request.args["delete"],))
        conn.commit()
        flash("Target audience dihapus!", "success")
        return redirect(url_for("admin_audience"))
    audiences = [dict(r) for r in conn.execute("SELECT * FROM audience ORDER BY sort_order").fetchall()]
    conn.close()
    return render_template("admin_audience.html", audiences=audiences, s=get_all_settings())

# --- Testimonials ---
@app.route("/admin/testimonials", methods=["GET", "POST"])
@login_required
def admin_testimonials():
    conn = get_db()
    c = conn.cursor()
    if request.method == "POST":
        action = request.form.get("action")
        if action == "add":
            c.execute("INSERT INTO testimonials (name, role, text, rating, image, sort_order) VALUES (?,?,?,?,?,?)",
                      (request.form["name"], request.form.get("role", ""),
                       request.form.get("text", ""), int(request.form.get("rating", 5)),
                       request.form.get("image", ""), 0))
            flash("Testimoni ditambahkan!", "success")
        elif action == "edit":
            c.execute("UPDATE testimonials SET name=?, role=?, text=?, rating=?, image=? WHERE id=?",
                      (request.form["name"], request.form.get("role", ""),
                       request.form.get("text", ""), int(request.form.get("rating", 5)),
                       request.form.get("image", ""), request.form["id"]))
            flash("Testimoni diupdate!", "success")
        conn.commit()
    if request.args.get("delete"):
        c.execute("DELETE FROM testimonials WHERE id=?", (request.args["delete"],))
        conn.commit()
        flash("Testimoni dihapus!", "success")
        return redirect(url_for("admin_testimonials"))
    testimonials = [dict(r) for r in conn.execute("SELECT * FROM testimonials ORDER BY sort_order").fetchall()]
    conn.close()
    return render_template("admin_testimonials.html", testimonials=testimonials, s=get_all_settings())

# --- FAQ ---
@app.route("/admin/faq", methods=["GET", "POST"])
@login_required
def admin_faq():
    conn = get_db()
    c = conn.cursor()
    if request.method == "POST":
        action = request.form.get("action")
        if action == "add":
            c.execute("INSERT INTO faq (question, answer, sort_order) VALUES (?,?,?)",
                      (request.form["question"], request.form.get("answer", ""), 0))
            flash("FAQ ditambahkan!", "success")
        elif action == "edit":
            c.execute("UPDATE faq SET question=?, answer=? WHERE id=?",
                      (request.form["question"], request.form.get("answer", ""), request.form["id"]))
            flash("FAQ diupdate!", "success")
        conn.commit()
    if request.args.get("delete"):
        c.execute("DELETE FROM faq WHERE id=?", (request.args["delete"],))
        conn.commit()
        flash("FAQ dihapus!", "success")
        return redirect(url_for("admin_faq"))
    faqs = [dict(r) for r in conn.execute("SELECT * FROM faq ORDER BY sort_order").fetchall()]
    conn.close()
    return render_template("admin_faq.html", faqs=faqs, s=get_all_settings())

# --- Chatbot ---
@app.route("/admin/chatbot", methods=["GET", "POST"])
@login_required
def admin_chatbot():
    conn = get_db()
    c = conn.cursor()
    if request.method == "POST":
        action = request.form.get("action")
        if action == "add":
            c.execute("INSERT INTO chatbot_responses (keywords, response, sort_order) VALUES (?,?,?)",
                      (request.form["keywords"], request.form["response"], 0))
            flash("Response ditambahkan!", "success")
        elif action == "edit":
            c.execute("UPDATE chatbot_responses SET keywords=?, response=? WHERE id=?",
                      (request.form["keywords"], request.form["response"], request.form["id"]))
            flash("Response diupdate!", "success")
        conn.commit()
    if request.args.get("delete"):
        c.execute("DELETE FROM chatbot_responses WHERE id=?", (request.args["delete"],))
        conn.commit()
        flash("Response dihapus!", "success")
        return redirect(url_for("admin_chatbot"))
    responses = [dict(r) for r in conn.execute("SELECT * FROM chatbot_responses ORDER BY sort_order").fetchall()]
    conn.close()
    return render_template("admin_chatbot.html", responses=responses, s=get_all_settings())

# --- Leads ---
@app.route("/admin/leads")
@login_required
def admin_leads():
    conn = get_db()
    leads = [dict(r) for r in conn.execute("SELECT * FROM leads ORDER BY id DESC").fetchall()]
    conn.close()
    return render_template("admin_leads.html", leads=leads, s=get_all_settings())

# --- Images ---
@app.route("/admin/images", methods=["GET", "POST"])
@login_required
def admin_images():
    conn = get_db()
    c = conn.cursor()
    if request.method == "POST":
        category = request.form.get("category", "general")
        files = request.files.getlist("files")
        count = 0
        for f in files:
            if f and f.filename:
                ext = f.filename.rsplit(".", 1)[-1].lower()
                if ext in ALLOWED_EXT:
                    fname = f"{uuid.uuid4().hex[:12]}.{ext}"
                    cat_dir = os.path.join(UPLOAD_DIR, category)
                    os.makedirs(cat_dir, exist_ok=True)
                    f.save(os.path.join(cat_dir, fname))
                    c.execute("INSERT INTO images (category, filename, original_name) VALUES (?,?,?)",
                              (category, fname, secure_filename(f.filename)))
                    count += 1
        conn.commit()
        flash(f"{count} gambar diupload!", "success")
        conn.close()
        return redirect(url_for("admin_images"))
    if request.args.get("delete"):
        img_id = request.args["delete"]
        row = c.execute("SELECT * FROM images WHERE id=?", (img_id,)).fetchone()
        if row:
            fpath = os.path.join(UPLOAD_DIR, row["category"], row["filename"])
            if os.path.exists(fpath): os.remove(fpath)
            c.execute("DELETE FROM images WHERE id=?", (img_id,))
            conn.commit()
            flash("Gambar dihapus!", "success")
        conn.close()
        return redirect(url_for("admin_images"))
    images = {}
    for r in c.execute("SELECT * FROM images ORDER BY category, sort_order, id DESC").fetchall():
        images.setdefault(r["category"], []).append(dict(r))
    conn.close()
    return render_template("admin_images.html", images=images, s=get_all_settings())

# ═══════════════════════════════════════════════════════
# 🎨 VISUAL DRAG-AND-DROP EDITOR
# ═══════════════════════════════════════════════════════

# ─── CSS-Based Editor (works on ALL themes) ──────────────────────

@app.route("/api/save-editor-css", methods=["POST"])
def api_save_editor_css():
    """Save editor CSS overrides — applies to ALL themes"""
    data = request.json or {}
    css_text = data.get("css", "")
    rules_data = data.get("data", {})
    rules_list = data.get("rules", [])

    # If rules list format (from editor.html), convert to CSS
    if rules_list and not css_text:
        css_lines = []
        for r in rules_list:
            sel = r.get("selector", "")
            css = r.get("css", "")
            if sel and css:
                css_lines.append(f"{sel} {{ {css} }}")
        css_text = "\n".join(css_lines)
        rules_data = {r["selector"]: r["css"] for r in rules_list if r.get("selector")}

    # Save rules JSON
    rules_path = os.path.join(BASE_DIR, "db", "editor_rules.json")
    os.makedirs(os.path.dirname(rules_path), exist_ok=True)
    with open(rules_path, "w") as f:
        json.dump(rules_data, f, indent=2)
    # Save CSS file
    css_path = os.path.join(BASE_DIR, "static", "css", "editor_overrides.css")
    with open(css_path, "w") as f:
        f.write("/* Editor Overrides — Auto-generated */\n/* Applies to ALL themes */\n\n")
        f.write(css_text)
    # Also save to editor_css_rules.json (used by normal pages)
    css_rules_for_page = []
    for sel, props in rules_data.items():
        if isinstance(props, dict):
            css_parts = []
            for p, v in props.items():
                css_parts.append(f"{p}: {v} !important")
            if css_parts:
                css_rules_for_page.append({"selector": sel, "css": "; ".join(css_parts)})
        elif isinstance(props, str):
            css_rules_for_page.append({"selector": sel, "css": props})
    css_rules_path = os.path.join(BASE_DIR, "db", "editor_css_rules.json")
    with open(css_rules_path, "w") as f:
        json.dump(css_rules_for_page, f, indent=2)

    return jsonify({"ok": True, "rules_count": len(css_rules_for_page)})


@app.route("/api/load-editor-css", methods=["GET"])
def api_load_editor_css():
    """Load saved editor rules"""
    rules_path = os.path.join(BASE_DIR, "db", "editor_rules.json")
    if os.path.exists(rules_path):
        with open(rules_path) as f:
            rules = json.load(f)
        return jsonify({"ok": True, "data": rules, "rules": rules})
    return jsonify({"ok": True, "data": {}, "rules": {}})

@app.route("/api/reset-editor-css", methods=["POST"])
def api_reset_editor_css():
    """Reset editor CSS"""
    for f in ["editor_rules.json", "editor_css_rules.json", "editor_layouts.json"]:
        p = os.path.join(BASE_DIR, "db", f)
        if os.path.exists(p):
            os.remove(p)
    css_path = os.path.join(BASE_DIR, "static", "css", "editor_overrides.css")
    if os.path.exists(css_path):
        with open(css_path, "w") as f:
            f.write("/* Reset */")
    return jsonify({"ok": True})


@app.route("/editor")
def visual_editor():
    """Visual editor — loads active theme with editor toolbar"""
    s = get_all_settings()
    conn = get_db()
    courses = [dict(r) for r in conn.execute("SELECT * FROM courses ORDER BY sort_order").fetchall()]
    modules = [dict(r) for r in conn.execute("SELECT * FROM modules ORDER BY sort_order").fetchall()]
    instructors = [dict(r) for r in conn.execute("SELECT * FROM instructors ORDER BY sort_order").fetchall()]
    testimonials = [dict(r) for r in conn.execute("SELECT * FROM testimonials ORDER BY sort_order").fetchall()]
    faqs = [dict(r) for r in conn.execute("SELECT * FROM faq ORDER BY sort_order").fetchall()]
    audiences = [dict(r) for r in conn.execute("SELECT * FROM audience ORDER BY sort_order").fetchall()]
    portfolios = [dict(r) for r in conn.execute("SELECT * FROM portfolio ORDER BY sort_order").fetchall()]
    conn.close()
    images = get_images_by_category()
    for c in courses:
        try: c["features"] = json.loads(c["features"])
        except: c["features"] = []
    for inst in instructors:
        try: inst["achievements"] = json.loads(inst["achievements"])
        except: inst["achievements"] = []
    theme = s.get("theme", "v1")
    tpl = "index_v2.html" if theme == "v2" else "index.html"
    layout_file = os.path.join(BASE_DIR, "db", "editor_layouts.json")
    layout_data = {}
    if os.path.exists(layout_file):
        with open(layout_file) as f:
            layout_data = json.load(f)
    return render_template(tpl, s=s, courses=courses, modules=modules,
                           instructors=instructors, testimonials=testimonials,
                           faqs=faqs, audiences=audiences, portfolios=portfolios,
                           images=images, layout_data=json.dumps(layout_data),
                           editor_mode=True)


# ─── Main ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    init_db()
    print("=" * 50)
    print("  🏠 BODHI Creative + Design")
    print("=" * 50)
    print(f"  🌐 Website: http://localhost:5001")
    print(f"  ⚙️  Admin:   http://localhost:5001/admin")
    print(f"  🔑 Password: {ADMIN_PASS}")
    print("=" * 50)
    app.run(host="0.0.0.0", port=5001, debug=True)
