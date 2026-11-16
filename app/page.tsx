"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";
import { Cloud, Folder, FolderPlus, Upload, Download, Trash2, Search, LogOut, File, Image as ImageIcon, FileText, RefreshCw, ChevronRight, HardDrive, X } from "lucide-react";

type FolderRow = { id: string; name: string; parent_id: string | null; created_at: string };
type FileRow = { id: string; name: string; size_bytes: number; mime_type: string | null; folder_id: string | null; created_at: string; status: string };

const supabase = supabaseBrowser();
const QUOTA = 100 * 1024 ** 3;
const fmt = (n: number) => n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : n < 1024 ** 3 ? `${(n / 1024 ** 2).toFixed(1)} MB` : `${(n / 1024 ** 3).toFixed(2)} GB`;
const fileIcon = (mime: string | null) => mime?.startsWith("image/") ? <ImageIcon size={19}/> : mime === "application/pdf" || mime?.includes("document") ? <FileText size={19}/> : <File size={19}/>;

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [quotaUsed, setQuotaUsed] = useState(0);
  const [newFolder, setNewFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  async function auth(action: "login" | "signup") {
    setBusy(true); setMessage("");
    const result = action === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (result.error) setMessage(result.error.message);
    else if (action === "signup") setMessage("Account created. If email confirmation is enabled, verify your email before signing in.");
    else setSession(result.data.session);
  }

  async function api(path: string, body?: any, method = "POST") {
    const token = session?.access_token;
    const res = await fetch(path, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  async function refresh() {
    if (!session) return;
    const [{ data: f }, { data: d }] = await Promise.all([
      supabase.from("folders").select("*").order("name"),
      supabase.from("files").select("*").eq("status", "complete").order("created_at", { ascending: false })
    ]);
    setFolders((f || []) as FolderRow[]);
    setFiles((d || []) as FileRow[]);
    setQuotaUsed((d || []).reduce((sum: number, row: any) => sum + Number(row.size_bytes || 0), 0));
  }

  useEffect(() => { if (session) refresh(); }, [session]);

  const visibleFiles = useMemo(() => files.filter(f => f.folder_id === currentFolder && f.name.toLowerCase().includes(search.toLowerCase())), [files, currentFolder, search]);
  const visibleFolders = useMemo(() => folders.filter(f => f.parent_id === currentFolder && f.name.toLowerCase().includes(search.toLowerCase())), [folders, currentFolder, search]);
  const folderPath = useMemo(() => {
    const path: FolderRow[] = []; let id = currentFolder;
    while (id) { const f = folders.find(x => x.id === id); if (!f) break; path.unshift(f); id = f.parent_id; }
    return path;
  }, [folders, currentFolder]);

  async function createFolder() {
    const name = folderName.trim();
    if (!name) return;
    setBusy(true); setMessage("");
    try { await api("/api/folders", { name, parent_id: currentFolder }); setFolderName(""); setNewFolder(false); await refresh(); }
    catch (e: any) { setMessage(e.message); }
    finally { setBusy(false); }
  }

  async function uploadFiles(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true); setMessage("");
    try {
      for (const file of Array.from(list)) {
        if (quotaUsed + file.size > QUOTA) throw new Error("This upload would exceed your 100 GiB storage quota.");
        const init = await api("/api/upload-url", { name: file.name, size_bytes: file.size, mime_type: file.type || "application/octet-stream", folder_id: currentFolder });
        const put = await fetch(init.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
        if (!put.ok) throw new Error(`Upload failed for ${file.name}. Check your R2 CORS settings and try again.`);
        await api("/api/complete-upload", { file_id: init.file_id });
        setQuotaUsed(v => v + file.size);
      }
      await refresh(); setMessage("Upload completed.");
    } catch (e: any) { setMessage(e.message); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  }

  async function downloadFile(file: FileRow) {
    setBusy(true);
    try { const result = await api("/api/download-url", { file_id: file.id }); window.open(result.downloadUrl, "_blank", "noopener,noreferrer"); }
    catch (e: any) { setMessage(e.message); }
    finally { setBusy(false); }
  }

  async function deleteFile(file: FileRow) {
    if (!confirm(`Delete "${file.name}" permanently?`)) return;
    setBusy(true);
    try { await api("/api/delete-file", { file_id: file.id }); await refresh(); setMessage("File deleted."); }
    catch (e: any) { setMessage(e.message); }
    finally { setBusy(false); }
  }

  async function logout() { await supabase.auth.signOut(); setSession(null); setFiles([]); setFolders([]); }

  if (!session) return <main className="auth-shell"><div className="auth-card"><div className="brand-mark"><Cloud size={28}/></div><h1>Cloud Storage Hub</h1><p className="muted">Your personal file space, available wherever you sign in.</p>
    <div className="tabs"><button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Sign in</button><button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>Create account</button></div>
    <label>Email address</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"/>
    <label>Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters"/>
    <button className="primary full" disabled={busy || !email || password.length < 8} onClick={() => auth(mode)}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
    {message && <p className="notice">{message}</p>}
    <p className="tiny">Use only for personal files or information you are authorized to store and transfer. Do not upload employer or client data without approval.</p>
  </div></main>;

  return <main className="app-shell">
    <header className="topbar"><div className="brand"><div className="brand-mark small"><Cloud size={21}/></div><span>Cloud Storage <b>Hub</b></span></div><div className="user-area"><span>{session.user.email}</span><button className="icon-btn" title="Sign out" onClick={logout}><LogOut size={18}/></button></div></header>
    <div className="content">
      <section className="welcome"><div><h1>My files</h1><p className="muted">Manage your personal cloud storage.</p></div><div className="actions"><button className="secondary" onClick={() => setNewFolder(true)}><FolderPlus size={17}/> New folder</button><button className="primary" onClick={() => inputRef.current?.click()} disabled={busy}><Upload size={17}/> Upload files</button><input ref={inputRef} type="file" multiple hidden onChange={e => uploadFiles(e.target.files)}/></div></section>
      <section className="storage-card"><div className="storage-icon"><HardDrive size={21}/></div><div className="storage-info"><div className="storage-head"><b>Storage used</b><span>{fmt(quotaUsed)} of 100 GB</span></div><div className="progress"><div style={{width: `${Math.min(100, quotaUsed / QUOTA * 100)}%`}}/></div><small>{Math.max(0, 100 - quotaUsed / QUOTA * 100).toFixed(1)}% available</small></div></section>
      {message && <div className="notice inline"><span>{message}</span><button onClick={() => setMessage("")}><X size={15}/></button></div>}
      {newFolder && <div className="modal-backdrop"><div className="modal"><h3>Create folder</h3><input autoFocus value={folderName} onChange={e => setFolderName(e.target.value)} placeholder="Folder name" onKeyDown={e => e.key === "Enter" && createFolder()}/><div className="modal-actions"><button className="secondary" onClick={() => setNewFolder(false)}>Cancel</button><button className="primary" disabled={busy || !folderName.trim()} onClick={createFolder}>Create</button></div></div></div>}
      <section className="file-panel">
        <div className="file-toolbar"><div className="breadcrumbs"><button onClick={() => setCurrentFolder(null)}>My files</button>{folderPath.map(f => <span key={f.id}><ChevronRight size={15}/><button onClick={() => setCurrentFolder(f.id)}>{f.name}</button></span>)}</div><div className="search"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search this folder"/></div></div>
        <div className="list-head"><span>Name</span><span>Size</span><span>Modified</span><span>Actions</span></div>
        {visibleFolders.map(f => <div className="file-row" key={f.id}><button className="file-name" onClick={() => { setCurrentFolder(f.id); setSearch(""); }}><Folder size={19} className="folder-color"/><b>{f.name}</b></button><span className="muted">—</span><span className="muted">{new Date(f.created_at).toLocaleDateString()}</span><span className="row-actions"><button className="icon-btn" title="Open folder" onClick={() => setCurrentFolder(f.id)}><ChevronRight size={17}/></button></span></div>)}
        {visibleFiles.map(f => <div className="file-row" key={f.id}><div className="file-name">{fileIcon(f.mime_type)}<span>{f.name}</span></div><span>{fmt(Number(f.size_bytes))}</span><span className="muted">{new Date(f.created_at).toLocaleDateString()}</span><span className="row-actions"><button className="icon-btn" title="Download" onClick={() => downloadFile(f)}><Download size={17}/></button><button className="icon-btn danger" title="Delete" onClick={() => deleteFile(f)}><Trash2 size={17}/></button></span></div>)}
        {!visibleFolders.length && !visibleFiles.length && <div className="empty"><Folder size={35}/><b>This folder is empty</b><span>Upload files or create a folder to get started.</span></div>}
        <div className="panel-footer"><span>{visibleFolders.length} folders · {visibleFiles.length} files</span><button className="text-btn" onClick={refresh}><RefreshCw size={14}/> Refresh</button></div>
      </section>
      <p className="footnote">Private storage · Files are stored in your private R2 bucket. Keep your account credentials secure.</p>
    </div>
  </main>;
}
