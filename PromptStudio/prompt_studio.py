"""Prompt Studio — local-first desktop app for Windows. MIT-licensed starter project."""
from __future__ import annotations

import json
import os
import re
import sqlite3
import threading
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
import tkinter as tk
from tkinter import ttk, messagebox, filedialog

APP_TITLE = "Prompt Studio • JRStudio"
APP_DIR = Path(os.getenv("APPDATA") or Path.home()) / "PromptStudio"
APP_DIR.mkdir(parents=True, exist_ok=True)
DB_FILE = APP_DIR / "prompt_studio.sqlite3"
DARK = "#101724"
PANEL = "#1c2739"
INPUT = "#27364b"
FG = "#edf4ff"
MUTED = "#b3c2d5"
ACCENT = "#76a6ff"

TEMPLATE = """YouTube {format} için {genre} reaction videosuna profesyonel kapak oluştur.\nSanatçı(lar): {artist}\nŞarkı: {song}\nAna başlık: {headline}\nTema: {theme}\nYayıncı fotoğrafını ve sanatçıların orijinal görsellerini yeniden çizme, yüzleri değiştirme. Yalnızca tasarım/kompozisyon ve tipografiyi düzenle. Videoya uygun, yüksek kontrastlı ve mobilde okunabilir bir tasarım hazırla."""


def connect():
    db = sqlite3.connect(DB_FILE)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("""CREATE TABLE IF NOT EXISTS prompts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'Genel',
        body TEXT NOT NULL, starred INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )""")
    db.commit()
    return db


def unique(items):
    seen = set()
    output = []
    for item in items:
        item = re.sub(r"\s+", " ", item).strip(" ,#\n\t")
        key = item.casefold()
        if item and key not in seen:
            output.append(item)
            seen.add(key)
    return output


def slug_tags(s):
    """Generate platform-neutral keyword variants without fabricating external analytics."""
    s = s.strip()
    if not s:
        return []
    out = [s]
    a = re.sub(r"\s*[xX×&+]\s*", " ", s)
    if a != s:
        out.append(a)
    out.extend(w for w in re.split(r"\s*[xX×&+]\s*", s) if w.strip())
    return unique(out)


def make_video_content(artist, song, channel, genre, kind, topic, extras):
    artist, song, channel, genre, topic, extras = [x.strip() for x in (artist, song, channel, genre, topic, extras)]
    kind = "Shorts" if kind == "Shorts (9:16)" else "Video"
    main = " - ".join(x for x in (artist, song) if x) or topic or "Yeni Şarkılar"
    video_topic = (topic or "Yeni çıkan şarkılara tepki").strip()
    titles = unique([
        f"{main} REACTION! 🔥 | {channel or 'Müzik Tepkisi'}",
        f"{main} Nasıl Olmuş?! 👀 | Reaction",
        f"{main} Dinledik! 🎧 İlk Tepkimiz",
        f"{artist or main} Yeni Şarkısını Dinledik! | {channel or 'Reaction'}",
    ])
    description = (
        f"🎧 {main} — Reaction!\n\n"
        f"{channel + ' ile ' if channel else ''}{video_topic.lower()}! "
        f"{artist + ' ' if artist else ''}{song + ' ' if song else ''}hakkındaki düşüncelerimizi paylaşıyoruz.\n\n"
        "💬 Sizce şarkı nasıl olmuş? Yorumlara yazın!\n"
        "👍 Beğenmeyi ve abone olmayı unutmayın.\n\n"
    )
    seed = []
    for v in [artist, song, channel]:
        seed.extend(slug_tags(v))
    both = " ".join(x for x in (artist, song) if x)
    base = [both, f"{both} reaction", f"{artist} reaction" if artist else "", f"{song} reaction" if song else "",
            f"{channel} reaction" if channel else "", genre, f"{genre} reaction" if genre else "",
            "müzik reaction", "şarkı tepkisi", "yeni çıkan şarkılar", "şarkı dinleme", "müzik dinleme",
            "türkçe rap", "rap reaction", "hip hop", "reaction", "youtube shorts" if kind == "Shorts" else "youtube video"]
    tags = unique(seed + base + [x.strip() for x in re.split(r"[,;\n]", extras) if x.strip()])
    # YouTube's total tag length limit is 500 chars; leave headroom.
    short_tags = []
    total = 0
    for t in tags:
        n = len(t) + (2 if short_tags else 0)
        if total + n > 480:
            continue
        short_tags.append(t)
        total += n
    hashtag_words = unique([channel, *slug_tags(artist), genre, "Reaction", "Shorts" if kind == "Shorts" else "Müzik"])
    hashtags = " ".join("#" + re.sub(r"[^\wÇĞİÖŞÜçğıöşü]", "", t) for t in hashtag_words if t)[:220]
    return titles, description + hashtags, ", ".join(short_tags), hashtags


def openai_generate(api_key, request_text, task):
    """Optional AI; the user's ChatGPT subscription is NOT an API credential."""
    payload = {
        "model": "gpt-4.1-mini",
        "instructions": ("Türkçe cevap ver. Kullanıcıya yardımcı, uygulanabilir ve doğal içerik üret. "
                         "Şarkıların yayımlanma tarihini veya dinlenme sayısını doğrulanmış gibi söyleme. "
                         "Görev: " + task),
        "input": request_text,
        "max_output_tokens": 1300,
    }
    req = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Authorization": "Bearer " + api_key.strip(), "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=50) as r:
            response = json.load(r)
    except urllib.error.HTTPError as e:
        error = e.read().decode("utf-8", "replace")[:350]
        raise RuntimeError(f"API HTTP {e.code}: {error}") from e
    chunks = []
    for item in response.get("output", []):
        for part in item.get("content", []):
            if part.get("type") == "output_text":
                chunks.append(part.get("text", ""))
    return "\n".join(chunks).strip() or "API yanıtı boş geldi."


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title(APP_TITLE)
        self.geometry("1170x780")
        self.minsize(900, 630)
        self.configure(bg=DARK)
        self.db = connect()
        self.selected_id = None
        self.api_key = tk.StringVar(value=os.getenv("OPENAI_API_KEY", ""))
        self.category_filter = tk.StringVar(value="Tümü")
        self.search_var = tk.StringVar()
        self.status = tk.StringVar(value=f"Veriler yalnızca bu bilgisayarda: {DB_FILE}")
        self.apply_style()
        self.create_ui()
        self.reload_prompts()
        self.protocol("WM_DELETE_WINDOW", self.close)

    def apply_style(self):
        st = ttk.Style(self)
        st.theme_use("clam")
        st.configure("TFrame", background=DARK)
        st.configure("TLabel", background=DARK, foreground=FG, font=("Segoe UI", 10))
        st.configure("TButton", background=PANEL, foreground=FG, padding=(10, 7), font=("Segoe UI", 10))
        st.map("TButton", background=[("active", "#344969")])
        st.configure("Accent.TButton", background="#285caa", foreground="white", padding=(12, 8))
        st.map("Accent.TButton", background=[("active", "#3475d2")])
        st.configure("TNotebook", background=DARK, borderwidth=0)
        st.configure("TNotebook.Tab", background=PANEL, foreground=FG, padding=(17, 10))
        st.map("TNotebook.Tab", background=[("selected", "#34527c")])
        st.configure("Treeview", background=PANEL, fieldbackground=PANEL, foreground=FG, rowheight=32, borderwidth=0)
        st.configure("Treeview.Heading", background="#32425a", foreground=FG)
        st.map("Treeview", background=[("selected", "#365f98")])
        st.configure("TCombobox", fieldbackground=INPUT, foreground="#111111")

    def title_label(self, parent, title, subtitle=None):
        tk.Label(parent, text=title, bg=DARK, fg=FG, font=("Segoe UI", 20, "bold")).pack(anchor="w", pady=(8, 3))
        if subtitle:
            tk.Label(parent, text=subtitle, bg=DARK, fg=MUTED, font=("Segoe UI", 10)).pack(anchor="w", pady=(0, 12))

    def entry(self, parent, label, default="", width=30):
        wrapper = tk.Frame(parent, bg=DARK)
        wrapper.pack(fill="x", pady=5)
        tk.Label(wrapper, text=label, fg=MUTED, bg=DARK, width=18, anchor="w").pack(side="left")
        var = tk.StringVar(value=default)
        tk.Entry(wrapper, textvariable=var, bg=INPUT, fg=FG, insertbackground=FG, relief="flat", font=("Segoe UI", 11), width=width).pack(side="left", fill="x", expand=True, ipady=8)
        return var

    def text_area(self, parent, height=12):
        w = tk.Text(parent, height=height, bg=INPUT, fg=FG, insertbackground=FG, selectbackground="#4272ad", relief="flat", wrap="word", font=("Consolas", 10), padx=12, pady=11, undo=True)
        return w

    def get_text(self, widget):
        return widget.get("1.0", "end-1c").strip()

    def put_text(self, widget, value):
        widget.delete("1.0", "end")
        widget.insert("1.0", value)

    def copy(self, value):
        self.clipboard_clear()
        self.clipboard_append(value)
        self.update()
        self.status.set("Panoya kopyalandı.")

    def create_ui(self):
        head = tk.Frame(self, bg=DARK)
        head.pack(fill="x", padx=22, pady=(14, 3))
        tk.Label(head, text="✦ PROMPT STUDIO", bg=DARK, fg=ACCENT, font=("Segoe UI", 21, "bold")).pack(side="left")
        tk.Label(head, text="JRStudio  •  Windows masaüstü  •  Yerel kütüphane", bg=DARK, fg=MUTED, font=("Segoe UI", 10)).pack(side="right", pady=12)
        self.notebook = ttk.Notebook(self)
        self.notebook.pack(fill="both", expand=True, padx=20, pady=10)
        self.tab_lib = ttk.Frame(self.notebook)
        self.tab_video = ttk.Frame(self.notebook)
        self.tab_ai = ttk.Frame(self.notebook)
        self.tab_settings = ttk.Frame(self.notebook)
        self.notebook.add(self.tab_lib, text="📚 Prompt Kütüphanesi")
        self.notebook.add(self.tab_video, text="▶ Video / Shorts Araçları")
        self.notebook.add(self.tab_ai, text="✦ AI Prompt Yazdır")
        self.notebook.add(self.tab_settings, text="⚙ Ayarlar")
        self.build_library()
        self.build_video()
        self.build_ai()
        self.build_settings()
        tk.Label(self, textvariable=self.status, bg="#172133", fg=MUTED, anchor="w", padx=18, pady=8, font=("Segoe UI", 9)).pack(fill="x", side="bottom")

    def build_library(self):
        parent = self.tab_lib
        toolbar = tk.Frame(parent, bg=DARK)
        toolbar.pack(fill="x", padx=12, pady=10)
        tk.Label(toolbar, text="Ara:", bg=DARK, fg=FG).pack(side="left")
        search = tk.Entry(toolbar, textvariable=self.search_var, bg=INPUT, fg=FG, insertbackground=FG, relief="flat", font=("Segoe UI", 11), width=28)
        search.pack(side="left", padx=8, ipady=7)
        self.search_var.trace_add("write", lambda *_: self.reload_prompts())
        self.cat_choice = ttk.Combobox(toolbar, state="readonly", textvariable=self.category_filter, width=20)
        self.cat_choice.pack(side="left", padx=8)
        self.cat_choice.bind("<<ComboboxSelected>>", lambda _: self.reload_prompts())
        ttk.Button(toolbar, text="+ Yeni prompt", style="Accent.TButton", command=self.new_prompt).pack(side="right")
        body = tk.PanedWindow(parent, orient="horizontal", bg=DARK, sashwidth=7, borderwidth=0)
        body.pack(fill="both", expand=True, padx=12, pady=(0, 12))
        left = tk.Frame(body, bg=DARK)
        right = tk.Frame(body, bg=DARK)
        body.add(left, minsize=260, width=365)
        body.add(right, minsize=440)
        self.tree = ttk.Treeview(left, columns=("cat",), show="tree headings", selectmode="browse")
        self.tree.heading("#0", text="Başlık")
        self.tree.heading("cat", text="Kategori")
        self.tree.column("#0", width=220)
        self.tree.column("cat", width=125)
        self.tree.pack(fill="both", expand=True)
        self.tree.bind("<<TreeviewSelect>>", self.select_prompt)
        self.name_var = self.entry(right, "Prompt adı:")
        self.cat_var = self.entry(right, "Kategori:", "Genel")
        tk.Label(right, text="Prompt metni (değişkenler: [SANATÇI], [ŞARKI], [FORMAT]...)", bg=DARK, fg=MUTED).pack(anchor="w", pady=(12, 5))
        self.prompt_body = self.text_area(right, height=21)
        self.prompt_body.pack(fill="both", expand=True)
        buttons = tk.Frame(right, bg=DARK)
        buttons.pack(fill="x", pady=12)
        for txt, func in [("Kaydet", self.save_prompt), ("Kopyala", lambda: self.copy(self.get_text(self.prompt_body))), ("Şablonu doldur", self.fill_template), ("★ Favori", self.toggle_star), ("Sil", self.delete_prompt)]:
            ttk.Button(buttons, text=txt, command=func).pack(side="left", padx=(0, 7))
        footer = tk.Frame(right, bg=DARK)
        footer.pack(fill="x")
        ttk.Button(footer, text="İçe aktar (.json)", command=self.import_json).pack(side="left")
        ttk.Button(footer, text="Dışa aktar (.json)", command=self.export_json).pack(side="left", padx=8)
        ttk.Button(footer, text="Metin olarak kaydet", command=lambda: self.export_txt(self.get_text(self.prompt_body))).pack(side="right")

    def reload_prompts(self):
        if not hasattr(self, "tree"):
            return
        rows = self.db.execute("SELECT * FROM prompts ORDER BY starred DESC, updated_at DESC").fetchall()
        cats = ["Tümü"] + sorted(set(r["category"] for r in rows), key=str.casefold)
        self.cat_choice["values"] = cats
        if self.category_filter.get() not in cats:
            self.category_filter.set("Tümü")
        for item in self.tree.get_children():
            self.tree.delete(item)
        q = self.search_var.get().strip().casefold()
        for r in rows:
            if self.category_filter.get() != "Tümü" and r["category"] != self.category_filter.get():
                continue
            if q and q not in (r["name"] + " " + r["category"] + " " + r["body"]).casefold():
                continue
            self.tree.insert("", "end", iid=str(r["id"]), text=("★ " if r["starred"] else "") + r["name"], values=(r["category"],))

    def select_prompt(self, _=None):
        selected = self.tree.selection()
        if not selected:
            return
        rid = int(selected[0])
        r = self.db.execute("SELECT * FROM prompts WHERE id=?", (rid,)).fetchone()
        if not r:
            return
        self.selected_id = rid
        self.name_var.set(r["name"])
        self.cat_var.set(r["category"])
        self.put_text(self.prompt_body, r["body"])

    def new_prompt(self):
        self.selected_id = None
        self.name_var.set("")
        self.cat_var.set("Genel")
        self.put_text(self.prompt_body, "")
        self.status.set("Yeni prompt oluşturabilirsiniz.")

    def save_prompt(self):
        name = self.name_var.get().strip()
        body = self.get_text(self.prompt_body)
        category = self.cat_var.get().strip() or "Genel"
        if not name or not body:
            messagebox.showwarning("Eksik bilgi", "Prompt adı ve metni boş olamaz.")
            return
        now = datetime.now().isoformat(timespec="seconds")
        if self.selected_id:
            self.db.execute("UPDATE prompts SET name=?, category=?, body=?, updated_at=? WHERE id=?", (name, category, body, now, self.selected_id))
        else:
            cur = self.db.execute("INSERT INTO prompts (name,category,body,created_at,updated_at) VALUES (?,?,?,?,?)", (name, category, body, now, now))
            self.selected_id = cur.lastrowid
        self.db.commit()
        self.reload_prompts()
        self.tree.selection_set(str(self.selected_id))
        self.status.set("Prompt kaydedildi.")

    def delete_prompt(self):
        if not self.selected_id:
            return
        if not messagebox.askyesno("Sil", "Seçili prompt silinsin mi?"):
            return
        self.db.execute("DELETE FROM prompts WHERE id=?", (self.selected_id,))
        self.db.commit()
        self.new_prompt()
        self.reload_prompts()

    def toggle_star(self):
        if not self.selected_id:
            return
        self.db.execute("UPDATE prompts SET starred=1-starred WHERE id=?", (self.selected_id,))
        self.db.commit()
        self.reload_prompts()

    def fill_template(self):
        text = self.get_text(self.prompt_body)
        fields = unique(re.findall(r"\[([^\[\]\n]{1,50})\]", text))
        if not fields:
            messagebox.showinfo("Şablon", "Bu promptta [DEĞİŞKEN] bulunamadı.")
            return
        popup = tk.Toplevel(self)
        popup.title("Şablon değişkenlerini doldur")
        popup.configure(bg=DARK)
        popup.geometry("520x" + str(min(690, 115 + 49 * len(fields))))
        vars_ = {}
        for field in fields:
            vars_[field] = self.entry(popup, field + ":")
        def done():
            out = text
            for key, val in vars_.items():
                out = out.replace("[" + key + "]", val.get())
            self.put_text(self.prompt_body, out)
            popup.destroy()
            self.status.set("Şablon dolduruldu. Kaydet veya kopyala.")
        ttk.Button(popup, text="Uygula", command=done, style="Accent.TButton").pack(pady=14)

    def export_json(self):
        filename = filedialog.asksaveasfilename(defaultextension=".json", filetypes=[("JSON", "*.json")], initialfile="prompt_studio_yedek.json")
        if filename:
            data = [dict(r) for r in self.db.execute("SELECT * FROM prompts ORDER BY id")]
            Path(filename).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            self.status.set("Kütüphane yedeklendi.")

    def import_json(self):
        filename = filedialog.askopenfilename(filetypes=[("JSON", "*.json")])
        if not filename:
            return
        try:
            items = json.loads(Path(filename).read_text(encoding="utf-8"))
            if not isinstance(items, list):
                raise ValueError("JSON dizisi gerekli")
            now = datetime.now().isoformat(timespec="seconds")
            if not messagebox.askyesno("İçe aktar", f"{len(items)} kayıt kütüphaneye eklensin mi? (Var olanlar silinmez)"):
                return
            for x in items:
                if not isinstance(x, dict) or not isinstance(x.get("name"), str) or not isinstance(x.get("body"), str):
                    raise ValueError("Kayıtlar name ve body alanlarını içermeli")
                self.db.execute("INSERT INTO prompts (name,category,body,starred,created_at,updated_at) VALUES (?,?,?,?,?,?)", (x["name"], str(x.get("category", "Genel")), x["body"], int(bool(x.get("starred", 0))), now, now))
            self.db.commit()
            self.reload_prompts()
            self.status.set("İçe aktarma tamamlandı.")
        except (ValueError, OSError, json.JSONDecodeError) as e:
            messagebox.showerror("İçe aktarma hatası", str(e))

    def export_txt(self, content):
        if not content.strip():
            return
        f = filedialog.asksaveasfilename(defaultextension=".txt", filetypes=[("Metin", "*.txt")])
        if f:
            Path(f).write_text(content, encoding="utf-8")

    def build_video(self):
        root = self.tab_video
        self.title_label(root, "Video & Shorts içerik asistanı", "Başlık, açıklama, etiket ve hashtag oluştur. Yerel öneriler internetsiz çalışır.")
        upper = tk.Frame(root, bg=DARK)
        upper.pack(fill="x", padx=9)
        form = tk.Frame(upper, bg=DARK)
        form.pack(side="left", fill="x", expand=True)
        self.video_artist = self.entry(form, "Sanatçı(lar):", "MERO x POİZİ")
        self.video_song = self.entry(form, "Şarkı:")
        self.video_channel = self.entry(form, "Kanal/yayıncı:", "BIGBAT")
        self.video_genre = self.entry(form, "Tür:", "Türkçe rap")
        self.video_topic = self.entry(form, "Video konusu:", "Yeni çıkan şarkıya reaction")
        self.video_extra = self.entry(form, "Ek etiketler:")
        row = tk.Frame(form, bg=DARK)
        row.pack(fill="x", pady=5)
        tk.Label(row, text="Format:", bg=DARK, fg=MUTED, width=18, anchor="w").pack(side="left")
        self.video_kind = tk.StringVar(value="Shorts (9:16)")
        ttk.Combobox(row, textvariable=self.video_kind, state="readonly", values=("Shorts (9:16)", "Normal video (16:9)"), width=28).pack(side="left")
        buttons = tk.Frame(upper, bg=DARK)
        buttons.pack(side="right", padx=14, anchor="n")
        ttk.Button(buttons, text="⚡ İçerik üret", style="Accent.TButton", command=self.generate_video).pack(fill="x", pady=4)
        ttk.Button(buttons, text="✦ AI ile iyileştir", command=self.ai_video).pack(fill="x", pady=4)
        ttk.Button(buttons, text="Tümünü kopyala", command=lambda: self.copy(self.get_text(self.video_result))).pack(fill="x", pady=4)
        ttk.Button(buttons, text="TXT olarak kaydet", command=lambda: self.export_txt(self.get_text(self.video_result))).pack(fill="x", pady=4)
        ttk.Button(buttons, text="Kütüphaneye kaydet", command=self.save_video_to_library).pack(fill="x", pady=4)
        self.video_result = self.text_area(root, height=19)
        self.video_result.pack(fill="both", expand=True, padx=9, pady=12)

    def generate_video(self):
        titles, description, tags, hashtags = make_video_content(self.video_artist.get(), self.video_song.get(), self.video_channel.get(), self.video_genre.get(), self.video_kind.get(), self.video_topic.get(), self.video_extra.get())
        out = "BAŞLIK ÖNERİLERİ\n" + "\n".join(f"{i}. {t}" for i, t in enumerate(titles, 1))
        out += "\n\nYOUTUBE AÇIKLAMASI\n" + description
        out += "\n\nYOUTUBE ETİKETLERİ (virgülle ayrılmış)\n" + tags
        out += "\n\nHASHTAGLER\n" + hashtags
        out += "\n\nNot: Etiketler anahtar kelime önerisidir; arama hacmi veya trend verisi doğrulanmamıştır."
        self.put_text(self.video_result, out)
        self.status.set("Başlık, açıklama, etiket ve hashtag üretildi.")

    def save_video_to_library(self):
        body = self.get_text(self.video_result)
        if not body:
            return
        self.new_prompt()
        self.name_var.set(f"{self.video_artist.get() or 'Video'} — {self.video_song.get() or 'Reaction'}")
        self.cat_var.set("YouTube")
        self.put_text(self.prompt_body, body)
        self.save_prompt()
        self.notebook.select(self.tab_lib)

    def build_ai(self):
        parent = self.tab_ai
        self.title_label(parent, "AI ile Prompt Yazdır", "Yapmak istediğini anlat. API olmadan temel şablon; API ile özelleştirilmiş prompt.")
        self.ai_task = self.entry(parent, "İşin konusu:", "YouTube Shorts reaction kapak tasarımı")
        self.ai_style = self.entry(parent, "Tercihlerin:", "Yüzler korunmalı, 9:16, sinematik")
        tk.Label(parent, text="Ek bilgiler / sınırlar", bg=DARK, fg=MUTED).pack(anchor="w", pady=(10, 5))
        self.ai_extra = self.text_area(parent, height=5)
        self.ai_extra.pack(fill="x")
        actions = tk.Frame(parent, bg=DARK)
        actions.pack(fill="x", pady=12)
        ttk.Button(actions, text="Şablon prompt oluştur (offline)", command=self.local_prompt).pack(side="left", padx=(0, 8))
        ttk.Button(actions, text="✦ AI ile prompt yazdır", command=self.ai_prompt, style="Accent.TButton").pack(side="left", padx=(0, 8))
        ttk.Button(actions, text="Kopyala", command=lambda: self.copy(self.get_text(self.ai_result))).pack(side="left", padx=(0, 8))
        ttk.Button(actions, text="Kütüphaneye kaydet", command=self.save_ai_to_library).pack(side="left")
        self.ai_result = self.text_area(parent, height=17)
        self.ai_result.pack(fill="both", expand=True, pady=(4, 12))

    def local_prompt(self):
        task = self.ai_task.get().strip() or "İstenen görevi gerçekleştir"
        prefs = self.ai_style.get().strip()
        detail = self.get_text(self.ai_extra)
        out = (f"GÖREV: {task}\n\nAMAÇ: Konuya uygun, profesyonel ve doğrudan kullanılabilir sonuç oluştur.\n"
               f"ÖZEL TERCİHLER: {prefs or 'Konuya uygun tasarım ve biçim seç.'}\n"
               f"EK GEREKSİNİMLER: {detail or 'Yok.'}\n\n"
               "KURALLAR:\n- Kullanıcı tarafından verilen görsel, metin, isim ve verileri izinsiz değiştirme.\n"
               "- Gerçek kişi fotoğraflarını yeniden üretmek yerine orijinalleri koru.\n"
               "- Eksik somut verileri uydurma.\n- Sonucu hedef platforma uygun biçimlendir.\n"
               "- İçerik tamamlandığında çıktı kalitesini ve yazımını kontrol et.")
        self.put_text(self.ai_result, out)

    def save_ai_to_library(self):
        body = self.get_text(self.ai_result)
        if not body:
            return
        self.new_prompt()
        self.name_var.set(self.ai_task.get() or "Yeni AI Prompt")
        self.cat_var.set("AI Üretim")
        self.put_text(self.prompt_body, body)
        self.save_prompt()
        self.notebook.select(self.tab_lib)

    def ai_request(self, user_text, task, receiver):
        key = self.api_key.get().strip()
        if not key:
            messagebox.showinfo("API anahtarı", "Ayarlar sekmesinde OpenAI API anahtarı girin. ChatGPT aboneliği tek başına API anahtarı sağlamaz.")
            self.notebook.select(self.tab_settings)
            return
        self.status.set("API isteği gönderiliyor…")
        def run():
            try:
                answer = openai_generate(key, user_text, task)
                self.after(0, lambda: (self.put_text(receiver, answer), self.status.set("AI yanıtı alındı.")))
            except Exception as e:
                self.after(0, lambda err=str(e): (self.status.set("AI isteği başarısız."), messagebox.showerror("API hatası", err)))
        threading.Thread(target=run, daemon=True).start()

    def ai_prompt(self):
        inp = ("Görev: " + self.ai_task.get() + "\nTercihler: " + self.ai_style.get() + "\nEk bilgiler: " + self.get_text(self.ai_extra))
        self.ai_request(inp, "İyi yapılandırılmış, ayrıntılı, doğrudan kopyalanabilir bir PROMPT yaz. Yalnızca promptu ver.", self.ai_result)

    def ai_video(self):
        details = (f"Sanatçı: {self.video_artist.get()}\nŞarkı: {self.video_song.get()}\nYayıncı: {self.video_channel.get()}\n"
                   f"Müzik türü: {self.video_genre.get()}\nVideo: {self.video_topic.get()}\nFormat: {self.video_kind.get()}\n"
                   f"Ek etiketler: {self.video_extra.get()}\n")
        self.ai_request(details, "YouTube video içeriği: 4 başlık önerisi, açıklama, 400-480 karakteri aşmayan virgüllü etiket listesi, 3-6 hashtag. Doğrulanmamış viral başarı iddiaları kurma.", self.video_result)

    def build_settings(self):
        parent = self.tab_settings
        self.title_label(parent, "Ayarlar ve veri güvenliği", "Uygulama yerel çalışır; internet yalnızca AI çağrılarında gerekir.")
        tk.Label(parent, text="OpenAI API anahtarı (isteğe bağlı, diske kaydedilmez)", bg=DARK, fg=FG, font=("Segoe UI", 11, "bold")).pack(anchor="w", pady=(20, 7))
        row = tk.Frame(parent, bg=DARK)
        row.pack(fill="x")
        tk.Entry(row, textvariable=self.api_key, show="•", bg=INPUT, fg=FG, insertbackground=FG, relief="flat", font=("Segoe UI", 11), width=60).pack(side="left", ipady=8)
        ttk.Button(row, text="Anahtarı temizle", command=lambda: self.api_key.set("")).pack(side="left", padx=12)
        notes = (
            "• ChatGPT Plus/Pro aboneliğiniz OpenAI API kullanımını otomatik olarak kapsamaz.\n"
            "• Bu ilk sürüm ChatGPT hesabı ile giriş yapmaz; promptlar yalnızca bilgisayarınızda saklanır.\n"
            "• API anahtarı yalnızca bu çalışma süresince bellekte tutulur. Uygulamayı kapatınca silinir.\n"
            "• API kullanırken girdiğiniz metinler OpenAI API hizmetine gönderilir.\n"
            "• Giriş, senkronizasyon, trend verisi ve otomatik video analizi sonraki sürüm özellikleridir.\n"
            "• Yerel YouTube etiketleri öneridir, YouTube arama/trend sonuçlarına dayanmaz.\n"
            f"\nVeritabanı: {DB_FILE}\n"
        )
        tk.Label(parent, text=notes, bg=DARK, fg=MUTED, font=("Segoe UI", 11), justify="left", anchor="nw", wraplength=930).pack(fill="x", pady=20)
        ttk.Button(parent, text="Veritabanı klasörünü aç", command=self.open_storage).pack(anchor="w")

    def open_storage(self):
        if os.name == "nt":
            os.startfile(APP_DIR)  # noqa: S606
        else:
            messagebox.showinfo("Veri klasörü", str(APP_DIR))

    def close(self):
        self.db.close()
        self.destroy()


if __name__ == "__main__":
    App().mainloop()
