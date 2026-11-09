import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { AppLayout } from "@/components/AppLayout";
import { ConnectEmailPrompt } from "@/components/EmailSetupModal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Mail, Send, Inbox, Star, Trash2, Reply, X, Paperclip, ChevronRight, ArrowLeft, RefreshCw, Edit3, AlertCircle, FileText, ShieldAlert, FolderOpen, ChevronDown, ChevronUp, Archive, Settings, MailX, Forward, Download, Eye } from "lucide-react";
import { format } from "date-fns";
import DOMPurify from "dompurify";

interface EmailMessage {
  id: string;
  subject: string;
  from: { name: string; address: string };
  toRecipients: { name: string; address: string }[];
  ccRecipients?: { name: string; address: string }[];
  bccRecipients?: { name: string; address: string }[];
  receivedDateTime?: string;
  sentDateTime?: string;
  bodyPreview: string;
  body?: { content: string; contentType: string };
  isRead: boolean;
  hasAttachments: boolean;
  importance: string;
  isDraft?: boolean;
  parentFolderId?: string;
}

interface EmailAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  isInline?: boolean;
}

const MAX_TOTAL_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const INLINE_VIEWABLE = /^(application\/pdf|image\/(png|jpe?g|gif|webp|bmp))$/i;

function formatSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function attachmentUrl(messageId: string, attId: string, inline = false) {
  return `/api/crm/email/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attId)}${inline ? "?disposition=inline" : ""}`;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = () => reject(new Error(`Could not read ${file.name}`));
    r.readAsDataURL(file);
  });
}

function splitAddresses(v: string) {
  return v.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
}

interface EmailFolder {
  id: string;
  displayName: string;
  parentFolderId: string | null;
  childFolderCount: number;
  totalItemCount: number;
  unreadItemCount: number;
  wellKnownName?: string;
}

interface EmailStatus {
  connected: boolean;
  email?: string;
  displayName?: string;
  staffEmail?: string;
  provider?: string;
  reason?: "not_configured" | "service_error" | "no_provider";
  detail?: string;
}

const WELL_KNOWN_ORDER = ["inbox", "drafts", "sentitems", "deleteditems", "junkemail", "archive"];
const FOLDER_ICONS: Record<string, typeof Inbox> = {
  inbox: Inbox,
  drafts: FileText,
  sentitems: Send,
  deleteditems: Trash2,
  junkemail: ShieldAlert,
  archive: Archive,
};

export default function Email() {
  const { isFrench: isFr } = useLanguage();
  const { data: emailStatus, isLoading: statusLoading } = useQuery<EmailStatus>({
    queryKey: ["/api/crm/email/status"],
    queryFn: async () => {
      const res = await fetch("/api/crm/email/status", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to check email status");
      return res.json();
    },
    staleTime: 60000,
  });

  if (statusLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[calc(100vh-2rem)]">
          <div className="text-center">
            <Mail className="w-16 h-16 mx-auto text-slate-500/20 mb-4 animate-pulse" />
            <h3 className="text-lg font-display font-bold" data-testid="text-email-loading">Checking email connection...</h3>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!emailStatus?.connected) {
    const isServiceError = emailStatus?.reason === "service_error";
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[calc(100vh-2rem)]">
          <div className="text-center max-w-md px-6">
            <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-6">
              {isServiceError ? (
                <AlertCircle className="w-10 h-10 text-amber-500/60" />
              ) : (
                <MailX className="w-10 h-10 text-slate-500/40" />
              )}
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-3" data-testid="text-email-not-connected">
              {isServiceError ? (isFr ? "Service courriel indisponible" : "Email Service Unavailable") : (isFr ? "Courriel non connecté" : "Email Not Connected")}
            </h2>
            <p className="text-slate-500 mb-6" data-testid="text-email-setup-info">
              {isServiceError
                ? "The email service is temporarily unavailable. Please try again later." + (emailStatus?.detail ? ` (${emailStatus.detail})` : "")
                : "To use email within Compass CRM, your email account needs to be connected. Connect your Microsoft or Google account below to get started."}
            </p>
            {(
              <div className="mb-6 space-y-3">
                <ConnectEmailPrompt testId="button-connect-email-email" />
                <p className="text-xs text-slate-500">Works with Microsoft 365 / Outlook and Google / Gmail. You can also manage this later in Settings.</p>
              </div>
            )}
            {emailStatus?.staffEmail && (
              <p className="text-xs text-slate-500" data-testid="text-staff-email-hint">
                Your staff email: <span className="font-mono font-medium text-foreground">{emailStatus.staffEmail}</span>
              </p>
            )}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <EmailClient connectedEmail={emailStatus.email} connectedDisplayName={emailStatus.displayName} />
    </AppLayout>
  );
}

function EmailClient({ connectedEmail, connectedDisplayName }: { connectedEmail?: string; connectedDisplayName?: string }) {
  const { isFrench: isFr } = useLanguage();
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedFolderWellKnown, setSelectedFolderWellKnown] = useState<string | undefined>("inbox");
  const [selectedFolderName, setSelectedFolderName] = useState(isFr ? "Boîte de réception" : "Inbox");
  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(null);
  const [composing, setComposing] = useState(false);
  const [replyingTo, setReplyingTo] = useState<EmailMessage | null>(null);
  const [forwarding, setForwarding] = useState<EmailMessage | null>(null);
  const [showCustomFolders, setShowCustomFolders] = useState(false);

  const { data: folders = [] } = useQuery<EmailFolder[]>({
    queryKey: ["/api/crm/email/folders"],
    queryFn: async () => {
      const res = await fetch("/api/crm/email/folders", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch folders");
      return res.json();
    },
    staleTime: 300000,
  });

  const wellKnownFolders = folders
    .filter(f => f.wellKnownName && WELL_KNOWN_ORDER.includes(f.wellKnownName))
    .sort((a, b) => WELL_KNOWN_ORDER.indexOf(a.wellKnownName!) - WELL_KNOWN_ORDER.indexOf(b.wellKnownName!));
  const customFolders = folders.filter(f => !f.wellKnownName && f.totalItemCount > 0);

  const inboxFolder = folders.find(f => f.wellKnownName === "inbox");
  const activeFolderId = selectedFolderId || inboxFolder?.id;

  useEffect(() => {
    if (!selectedFolderId && inboxFolder) {
      setSelectedFolderId(inboxFolder.id);
    }
  }, [inboxFolder?.id]);

  const selectFolder = (folder: EmailFolder) => {
    setSelectedFolderId(folder.id);
    setSelectedFolderWellKnown(folder.wellKnownName);
    setSelectedFolderName(folder.displayName);
    setSelectedMessage(null);
    setComposing(false);
  };

  return (
    <div className="flex h-[calc(100vh-2rem)] -mt-2 -mb-2">
      <div className="w-56 flex-shrink-0 bg-white border-r border-border flex flex-col overflow-hidden">
        {connectedEmail && (
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/30">
              <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                {(connectedDisplayName || connectedEmail)[0].toUpperCase()}
              </div>
              <span className="text-xs text-slate-500 truncate" data-testid="text-connected-email">{connectedEmail}</span>
            </div>
          </div>
        )}
        <div className="p-4 pt-2">
          <button
            onClick={() => { setComposing(true); setSelectedMessage(null); setReplyingTo(null); }}
            data-testid="button-compose-email"
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground font-semibold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl transition-all"
          >
            <Edit3 className="w-4 h-4" />
            Compose
          </button>
        </div>
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {wellKnownFolders.map(folder => {
            const Icon = FOLDER_ICONS[folder.wellKnownName || ""] || FolderOpen;
            return (
              <button
                key={folder.id}
                onClick={() => selectFolder(folder)}
                data-testid={`button-folder-${folder.displayName.toLowerCase().replace(/\s/g, '-')}`}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeFolderId === folder.id ? "bg-primary/10 text-primary font-semibold" : "text-slate-500 hover:bg-muted"
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate flex-1 text-left">{folder.displayName}</span>
                {folder.unreadItemCount > 0 && (
                  <span className="text-xs font-bold bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">{folder.unreadItemCount}</span>
                )}
              </button>
            );
          })}

          {customFolders.length > 0 && (
            <>
              <button
                onClick={() => setShowCustomFolders(!showCustomFolders)}
                data-testid="button-toggle-custom-folders"
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold text-slate-500/60 uppercase tracking-wider hover:text-slate-500 transition-colors mt-3"
              >
                <span className="flex-1 text-left">Folders</span>
                {showCustomFolders ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {showCustomFolders && customFolders.map(folder => (
                <button
                  key={folder.id}
                  onClick={() => selectFolder(folder)}
                  data-testid={`button-folder-custom-${folder.id}`}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                    activeFolderId === folder.id ? "bg-primary/10 text-primary font-semibold" : "text-slate-500 hover:bg-muted"
                  }`}
                >
                  <FolderOpen className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate flex-1 text-left">{folder.displayName}</span>
                  {folder.unreadItemCount > 0 && (
                    <span className="text-xs font-bold bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">{folder.unreadItemCount}</span>
                  )}
                </button>
              ))}
            </>
          )}
        </nav>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {composing ? (
          <ComposeView
            replyTo={replyingTo}
            forwardOf={forwarding}
            onCancel={() => { setComposing(false); setReplyingTo(null); setForwarding(null); }}
            onSent={() => { setComposing(false); setReplyingTo(null); setForwarding(null); }}
          />
        ) : selectedMessage ? (
          <MessageDetail
            message={selectedMessage}
            folderWellKnown={selectedFolderWellKnown}
            folderName={selectedFolderName}
            onBack={() => setSelectedMessage(null)}
            onReply={() => { setForwarding(null); setReplyingTo(selectedMessage); setComposing(true); }}
            onForward={() => { setReplyingTo(null); setForwarding(selectedMessage); setComposing(true); }}
            onDelete={() => setSelectedMessage(null)}
            folderId={activeFolderId || ""}
          />
        ) : activeFolderId ? (
          <MessageList
            folderId={activeFolderId}
            folderName={selectedFolderName}
            folderWellKnown={selectedFolderWellKnown}
            onSelect={setSelectedMessage}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Mail className="w-16 h-16 mx-auto text-slate-500/20 mb-4" />
              <h3 className="text-lg font-display font-bold">Loading...</h3>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MessageList({ folderId, folderWellKnown, onSelect, folderName }: { folderId: string; folderName: string; folderWellKnown?: string; onSelect: (msg: EmailMessage) => void }) {
  const queryClient = useQueryClient();
  const endpoint = `/api/crm/email/folders/${folderId}/messages`;
  const isSentFolder = folderWellKnown === "sentitems";
  const isDraftFolder = folderWellKnown === "drafts";

  const { data: messages, isLoading, error } = useQuery<EmailMessage[]>({
    queryKey: ["/api/crm/email/folders", folderId, "messages"],
    queryFn: async () => {
      const res = await fetch(endpoint, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    refetchInterval: 60000,
  });

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-destructive/50 mb-3" />
          <h3 className="text-lg font-display font-bold">Connection Error</h3>
          <p className="text-sm text-slate-500 mt-1">Could not connect to your email. Please try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-white">
        <h2 className="text-base font-bold text-slate-900" data-testid="text-mail-view-title">
          {folderName}
        </h2>
        <button
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/crm/email/folders", folderId, "messages"] });
            queryClient.invalidateQueries({ queryKey: ["/api/crm/email/folders"] });
          }}
          data-testid="button-refresh-mail"
          className="p-2 rounded-lg text-slate-500 hover:text-primary hover:bg-primary/5 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-0 animate-pulse">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="px-6 py-4 border-b border-border/50">
                <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : !messages || messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Mail className="w-16 h-16 mx-auto text-slate-500/20 mb-4" />
              <h3 className="text-lg font-display font-bold">No Messages</h3>
              <p className="text-sm text-slate-500 mt-1">
                This folder is empty.
              </p>
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <button
              key={msg.id}
              onClick={() => onSelect(msg)}
              data-testid={`row-message-${msg.id}`}
              className={`w-full text-left px-6 py-4 border-b border-border/50 hover:bg-muted/30 transition-colors ${
                !msg.isRead && !isSentFolder ? "bg-primary/[0.02]" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {!msg.isRead && !isSentFolder && (
                      <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                    )}
                    <span className={`text-sm truncate ${!msg.isRead && !isSentFolder ? "font-bold text-foreground" : "font-medium text-foreground/80"}`}>
                      {isSentFolder
                        ? (msg.toRecipients?.[0]?.name || msg.toRecipients?.[0]?.address || "Unknown")
                        : (msg.from?.name || msg.from?.address || "Unknown")}
                    </span>
                    {isDraftFolder && (
                      <span className="text-[10px] uppercase font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Draft</span>
                    )}
                    <span className="text-xs text-slate-500 ml-auto flex-shrink-0">
                      {formatDate(msg.receivedDateTime || msg.sentDateTime)}
                    </span>
                  </div>
                  <p className={`text-sm truncate mb-1 ${!msg.isRead && !isSentFolder ? "font-semibold" : ""}`}>
                    {msg.subject || "(No Subject)"}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{msg.bodyPreview}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 pt-1">
                  {msg.hasAttachments && <Paperclip className="w-3.5 h-3.5 text-slate-500" />}
                  {msg.importance === "high" && <Star className="w-3.5 h-3.5 text-amber-500" />}
                  <ChevronRight className="w-4 h-4 text-slate-500/50" />
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function MessageDetail({ message, folderWellKnown, onBack, onReply, onForward, onDelete, folderId, folderName }: {
  message: EmailMessage;
  folderWellKnown?: string;
  folderName: string;
  onBack: () => void;
  onReply: () => void;
  onForward: () => void;
  onDelete: () => void;
  folderId: string;
}) {
  const queryClient = useQueryClient();
  const isInboxLike = !["sentitems", "drafts"].includes(folderWellKnown || "");

  const { data: fullMessage } = useQuery<EmailMessage>({
    queryKey: ["/api/crm/email/messages", message.id],
    queryFn: async () => {
      const res = await fetch(`/api/crm/email/messages/${message.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: attachments = [] } = useQuery<EmailAttachment[]>({
    queryKey: ["/api/crm/email/messages", message.id, "attachments"],
    enabled: !!(fullMessage?.hasAttachments ?? message.hasAttachments),
    queryFn: async () => {
      const res = await fetch(`/api/crm/email/messages/${encodeURIComponent(message.id)}/attachments`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load attachments");
      return res.json();
    },
  });
  const visibleAttachments = attachments.filter((a) => !a.isInline);

  const hasMarkedReadRef = useRef(false);

  const markRead = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/crm/email/messages/${message.id}/read`, { method: "PATCH", credentials: "include" });
      if (!res.ok) throw new Error("Failed to mark as read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/email/folders", folderId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/email/folders"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/crm/email/messages/${message.id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/email/folders", folderId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/email/folders"] });
      onDelete();
    },
  });

  useEffect(() => {
    if (isInboxLike && message.isRead === false && !hasMarkedReadRef.current) {
      hasMarkedReadRef.current = true;
      markRead.mutate();
    }
  }, [message.id]);

  const msg = fullMessage || message;
  const bodyHtml = msg.body?.content || msg.bodyPreview || "";

  return (
    <div className="flex-1 flex flex-col bg-white">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <button onClick={onBack} data-testid="button-back-to-list" className="p-2 rounded-lg text-slate-500 hover:text-primary hover:bg-primary/5 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1" />
        {isInboxLike && (
          <button onClick={onReply} data-testid="button-reply" className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-border text-slate-500 hover:text-primary hover:border-primary/30 transition-all">
            <Reply className="w-4 h-4" /> Reply
          </button>
        )}
        <button onClick={onForward} data-testid="button-forward" className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-border text-slate-500 hover:text-primary hover:border-primary/30 transition-all">
          <Forward className="w-4 h-4" /> Forward
        </button>
        <button
          onClick={() => { if (confirm("Delete this message?")) deleteMutation.mutate(); }}
          data-testid="button-delete-message"
          className="p-2 rounded-lg text-slate-500 hover:text-destructive hover:bg-destructive/5 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <h1 className="text-lg font-bold text-slate-900 mb-4" data-testid="text-message-subject">{msg.subject || "(No Subject)"}</h1>

        <div className="flex items-start gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm flex-shrink-0">
            {(msg.from?.name || msg.from?.address || "?")[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold">{msg.from?.name || msg.from?.address}</p>
            <p className="text-xs text-slate-500">{msg.from?.address}</p>
            <p className="text-xs text-slate-500 mt-1">
              To: {msg.toRecipients?.map(r => r.name || r.address).join(", ")}
            </p>
            {!!msg.ccRecipients?.length && (
              <p className="text-xs text-slate-500" data-testid="text-message-cc">
                Cc: {msg.ccRecipients.map(r => r.name || r.address).join(", ")}
              </p>
            )}
            {!!msg.bccRecipients?.length && (
              <p className="text-xs text-slate-500" data-testid="text-message-bcc">
                Bcc: {msg.bccRecipients.map(r => r.name || r.address).join(", ")}
              </p>
            )}
          </div>
          <span className="text-xs text-slate-500 flex-shrink-0">
            {msg.receivedDateTime ? format(new Date(msg.receivedDateTime), "MMM d, yyyy 'at' h:mm a") : ""}
          </span>
        </div>

        {visibleAttachments.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2" data-testid="list-attachments">
            {visibleAttachments.map((a) => (
              <div key={a.id} className="flex items-center gap-2 border border-border rounded-xl px-3 py-2 text-sm bg-slate-50 max-w-full">
                <Paperclip className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <span className="truncate max-w-[220px]" title={a.name}>{a.name}</span>
                <span className="text-xs text-slate-500 flex-shrink-0">{formatSize(a.size)}</span>
                {INLINE_VIEWABLE.test(a.contentType) && (
                  <a href={attachmentUrl(message.id, a.id, true)} target="_blank" rel="noopener noreferrer" title="Open" data-testid={`link-open-attachment-${a.id}`} className="p-1 rounded text-slate-500 hover:text-primary">
                    <Eye className="w-4 h-4" />
                  </a>
                )}
                <a href={attachmentUrl(message.id, a.id)} download={a.name} title="Download" data-testid={`link-download-attachment-${a.id}`} className="p-1 rounded text-slate-500 hover:text-primary">
                  <Download className="w-4 h-4" />
                </a>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-border pt-6">
          {msg.body?.contentType === "html" ? (
            <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(bodyHtml, { ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'u', 'em', 'strong', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'img', 'hr'], ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'style', 'target', 'rel'], ALLOW_DATA_ATTR: false }) }} />
          ) : (
            <div className="whitespace-pre-wrap text-sm">{bodyHtml}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ComposeView({ replyTo, forwardOf, onCancel, onSent }: {
  replyTo: EmailMessage | null;
  forwardOf: EmailMessage | null;
  onCancel: () => void;
  onSent: () => void;
}) {
  const { isFrench: isFr } = useLanguage();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [to, setTo] = useState(replyTo ? replyTo.from?.address || "" : "");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [showBcc, setShowBcc] = useState(false);
  const [subject, setSubject] = useState(
    replyTo ? `Re: ${replyTo.subject}` : forwardOf ? (/^fwd?:/i.test(forwardOf.subject) ? forwardOf.subject : `Fwd: ${forwardOf.subject}`) : "",
  );
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [includeOriginal, setIncludeOriginal] = useState(true);
  const [error, setError] = useState("");

  const totalBytes = files.reduce((n, f) => n + f.size, 0);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...files, ...Array.from(list)];
    if (next.length > 10) return setError(isFr ? "Maximum 10 pièces jointes." : "You can attach up to 10 files.");
    if (next.reduce((n, f) => n + f.size, 0) > MAX_TOTAL_ATTACHMENT_BYTES) {
      return setError(isFr ? "Les pièces jointes dépassent 25 Mo." : "Attachments can total up to 25 MB.");
    }
    setError("");
    setFiles(next);
  };

  const sendMutation = useMutation({
    mutationFn: async () => {
      setError("");
      const attachments = await Promise.all(
        files.map(async (f) => ({ name: f.name, contentType: f.type || "application/octet-stream", contentBase64: await readFileAsBase64(f) })),
      );
      const ccList = splitAddresses(cc);
      const bccList = splitAddresses(bcc);
      const common = { bodyFormat: "text", ccRecipients: ccList, bccRecipients: bccList, attachments };
      let url = "/api/crm/email/messages/send";
      let payload: Record<string, unknown>;
      if (replyTo) {
        url = `/api/crm/email/messages/${encodeURIComponent(replyTo.id)}/reply`;
        payload = { ...common, comment: body };
      } else if (forwardOf) {
        url = `/api/crm/email/messages/${encodeURIComponent(forwardOf.id)}/forward`;
        payload = { ...common, comment: body, toRecipients: splitAddresses(to), includeAttachments: includeOriginal };
      } else {
        payload = { ...common, subject, body, toRecipients: splitAddresses(to) };
      }
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to send");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/email/folders"] });
      onSent();
    },
    onError: (e: Error) => setError(e.message),
  });

  const title = replyTo ? (isFr ? "Répondre" : "Reply") : forwardOf ? (isFr ? "Transférer" : "Forward") : (isFr ? "Nouveau message" : "New Message");
  const needsTo = !replyTo;
  const canSend = !sendMutation.isPending && (!needsTo || (to.trim() && subject.trim())) && (replyTo || forwardOf ? true : !!body.trim() || files.length > 0);

  return (
    <div className="flex-1 flex flex-col bg-white">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h2 className="text-base font-bold text-slate-900" data-testid="text-compose-title">{title}</h2>
        <button onClick={onCancel} data-testid="button-cancel-compose" className="p-2 rounded-lg text-slate-500 hover:text-foreground hover:bg-muted transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-border">
          <div className="flex items-center px-6 py-3 border-b border-border/50">
            <span className="text-sm font-medium text-slate-500 w-14">To:</span>
            <input type="text" value={to} onChange={e => setTo(e.target.value)} disabled={!!replyTo} placeholder="recipient@example.com" data-testid="input-compose-to" className="flex-1 text-sm bg-transparent focus:outline-none disabled:text-slate-500" />
            {!showBcc && (
              <button type="button" onClick={() => setShowBcc(true)} data-testid="button-show-bcc" className="text-xs font-medium text-primary hover:underline">Bcc</button>
            )}
          </div>
          <div className="flex items-center px-6 py-3 border-b border-border/50">
            <span className="text-sm font-medium text-slate-500 w-14">Cc:</span>
            <input type="text" value={cc} onChange={e => setCc(e.target.value)} placeholder={isFr ? "Facultatif" : "Optional"} data-testid="input-compose-cc" className="flex-1 text-sm bg-transparent focus:outline-none" />
          </div>
          {showBcc && (
            <div className="flex items-center px-6 py-3 border-b border-border/50">
              <span className="text-sm font-medium text-slate-500 w-14">Bcc:</span>
              <input type="text" value={bcc} onChange={e => setBcc(e.target.value)} placeholder={isFr ? "Facultatif (cachés aux autres)" : "Optional (hidden from other recipients)"} data-testid="input-compose-bcc" className="flex-1 text-sm bg-transparent focus:outline-none" />
            </div>
          )}
          <div className="flex items-center px-6 py-3">
            <span className="text-sm font-medium text-slate-500 w-14">Subject:</span>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)} disabled={!!replyTo || !!forwardOf} placeholder={isFr ? "Sujet du courriel" : "Email subject"} data-testid="input-compose-subject" className="flex-1 text-sm bg-transparent focus:outline-none disabled:text-slate-500" />
          </div>
        </div>

        <div className="p-6">
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder={forwardOf ? (isFr ? "Ajouter un message (facultatif)..." : "Add a message (optional)...") : "Write your message..."}
            data-testid="input-compose-body"
            className="w-full min-h-[240px] text-sm bg-transparent focus:outline-none resize-none"
          />
          {forwardOf && (
            <div className="mt-4 border-l-2 border-slate-300 pl-3 text-xs text-slate-500">
              <p>{isFr ? "Message transféré" : "Forwarded message"}: <span className="font-medium">{forwardOf.subject}</span></p>
              <p>{forwardOf.from?.name || forwardOf.from?.address}</p>
              {forwardOf.hasAttachments && (
                <label className="flex items-center gap-2 mt-2 text-slate-700">
                  <input type="checkbox" checked={includeOriginal} onChange={e => setIncludeOriginal(e.target.checked)} data-testid="checkbox-include-original-attachments" />
                  {isFr ? "Inclure les pièces jointes d'origine" : "Include original attachments"}
                </label>
              )}
            </div>
          )}

          {files.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2" data-testid="list-compose-attachments">
              {files.map((f, i) => (
                <div key={`${f.name}-${i}`} className="flex items-center gap-2 border border-border rounded-xl px-3 py-1.5 text-sm bg-slate-50">
                  <Paperclip className="w-4 h-4 text-slate-500" />
                  <span className="truncate max-w-[200px]" title={f.name}>{f.name}</span>
                  <span className="text-xs text-slate-500">{formatSize(f.size)}</span>
                  <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="Remove attachment" className="p-0.5 text-slate-500 hover:text-destructive">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <span className="text-xs text-slate-500 self-center">{formatSize(totalBytes)} / 25 MB</span>
            </div>
          )}
          {error && (
            <p className="mt-4 text-sm text-destructive flex items-center gap-2" data-testid="text-compose-error">
              <AlertCircle className="w-4 h-4" /> {error}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-background/50">
        <div className="flex items-center gap-2">
          <button onClick={onCancel} className="px-6 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:bg-muted transition-colors">
            Discard
          </button>
          <input ref={fileInputRef} type="file" multiple className="hidden" data-testid="input-compose-files" onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
          <button type="button" onClick={() => fileInputRef.current?.click()} data-testid="button-attach-file" className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-border text-slate-500 hover:text-primary hover:border-primary/30 transition-all">
            <Paperclip className="w-4 h-4" /> {isFr ? "Joindre" : "Attach"}
          </button>
        </div>
        <button
          onClick={() => sendMutation.mutate()}
          disabled={!canSend}
          data-testid="button-send-email"
          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground font-semibold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
          {sendMutation.isPending ? (isFr ? "Envoi..." : "Sending...") : (isFr ? "Envoyer" : "Send")}
        </button>
      </div>
    </div>
  );
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return format(date, "h:mm a");
  const isThisYear = date.getFullYear() === now.getFullYear();
  if (isThisYear) return format(date, "MMM d");
  return format(date, "MMM d, yyyy");
}
