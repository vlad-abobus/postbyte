import ReactMarkdown from 'react-markdown';
import { Post } from '../types';
import { formatDate, isGifImage } from '../lib/utils';
import { MessageSquare, Flag, Shield, Trash2, Check, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { forumService, resolveMediaUrl } from '../services/forumService';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';

const REPORT_PRESETS = [
  'Спам / флуд',
  'Оскорбления / травля',
  'NSFW / 18+ контент',
  'Нарушение правил доски',
  'Другое',
];

interface PostItemProps {
  post: Post;
  isOp?: boolean;
  threadTitle?: string;
  boardId?: string;
  threadId?: string;
  onDelete?: (info: { postId: string; deletedThread: boolean }) => void;
  isPreview?: boolean;
  hideActions?: boolean;
  canDelete?: boolean;
}

export function PostItem({ post, isOp, threadTitle, boardId, threadId, onDelete, isPreview, hideActions, canDelete }: PostItemProps) {
  const { user: me } = useAuth();
  const [showReportModal, setShowReportModal] = useState(false);
  const [reported, setReported] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [modalImage, setModalImage] = useState<{ url: string; filename: string; isGif: boolean } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setAvatarFailed(false);
  }, [post.authorPhotoURL]);

  useEffect(() => {
    if (!modalImage && !showReportModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModalImage(null);
        setShowReportModal(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalImage, showReportModal]);

  const handleDelete = async () => {
    if (!boardId || !threadId) return;
    const promptText = isOp
      ? 'Удалить этот тред целиком (ОП-пост и все ответы)?'
      : 'Удалить этот пост?';
    if (!window.confirm(promptText)) return;

    setDeleting(true);
    try {
      const res = await forumService.deletePost(boardId, threadId, post.id);
      onDelete?.({ postId: post.id, deletedThread: Boolean(res?.deletedThread || isOp) });
    } catch (e: any) {
      alert(e?.message || 'Не удалось удалить пост');
    } finally {
      setDeleting(false);
    }
  };

  const handleQuote = () => {
    const textarea = document.querySelector('textarea');
    if (textarea) {
      const currentVal = textarea.value;
      const quoteId = post.id.slice(0, 8);
      textarea.value = `${currentVal}${currentVal ? '\n' : ''}>>${quoteId}\n`;
      textarea.focus();
    }
  };

  const isStaff = post.authorRole === 'admin' || post.authorRole === 'moderator';
  const isOwnPost = Boolean(me?.uid && post.authorUid && me.uid === post.authorUid);
  const canReport = Boolean(boardId && threadId && !isOwnPost);
  const resolvedImageUrl = resolveMediaUrl(post.image?.url);
  const resolvedAvatarUrl = post.authorUid ? resolveMediaUrl(post.authorPhotoURL) : '';
  const attachmentIsGif = isGifImage(resolvedImageUrl, post.image?.filename);
  const displayTitle = isOp ? (threadTitle ?? post.threadTitle ?? '').trim() : '';

  return (
    <>
      <div className={isOp ? 'op-post' : 'post'}>
        <div className="flex flex-col gap-1">
          {/* Thread Subject / Title on OP Post */}
          {displayTitle && (
            <div className="mb-0.5">
              {isPreview && boardId && threadId ? (
                <Link
                  to={`/${boardId}/thread/${threadId}`}
                  className="text-base font-bold text-[var(--color-post-header)] hover:text-[var(--color-link-hover)] hover:underline break-words"
                >
                  {displayTitle}
                </Link>
              ) : (
                <h2 className="text-lg font-bold text-[var(--color-post-header)] leading-snug break-words">
                  {displayTitle}
                </h2>
              )}
            </div>
          )}

          {/* Header */}
          <div className={`flex items-center gap-2 text-xs flex-wrap ${isOp ? 'op-header' : ''}`}>
            {post.authorUid ? (
              <Link to={`/profile/${post.authorUid}`} className="font-bold text-[var(--color-post-header)] inline-flex items-center gap-1.5 hover:underline">
                {resolvedAvatarUrl && !avatarFailed && (
                  <img
                    src={resolvedAvatarUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarFailed(true)}
                    className="w-[18px] h-[18px] object-cover border border-[var(--color-border)] bg-white shrink-0"
                  />
                )}
                <span>{post.authorName || 'Аноним'}</span>
                {isStaff && <Shield size={10} className="text-[var(--color-post-header)]" />}
              </Link>
            ) : (
              <span className="font-bold text-[var(--color-post-header)] inline-flex items-center gap-1">
                {post.authorName || 'Аноним'}
                {isStaff && <Shield size={10} className="text-[var(--color-post-header)]" />}
              </span>
            )}

            {post.authorRole && post.authorRole !== 'user' && (
              <span className="bg-[var(--color-post-header)] text-white px-1 text-[8px] font-bold rounded uppercase">
                {post.authorRole}
              </span>
            )}

            <span className="text-[var(--color-muted)]">{formatDate(post.createdAt)}</span>
            <span className="post-id" onClick={handleQuote}>
              ID: <span className="font-mono">{post.id.slice(0, 8)}</span>
            </span>
            {!hideActions && !isPreview && (
              <button onClick={handleQuote} className="post-link bg-transparent border-none p-0 inline-flex items-center gap-0.5 cursor-pointer">
                <MessageSquare size={10} />
                Цитата
              </button>
            )}
            {canReport && (
              reported ? (
                <span className="text-[var(--color-accent)] font-bold inline-flex items-center gap-0.5 text-[11px]">
                  <Check size={10} />
                  Репорт отправлен
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowReportModal(true)}
                  className="post-link text-orange-700 bg-transparent border-none p-0 inline-flex items-center gap-0.5 cursor-pointer"
                >
                  <Flag size={10} />
                  Жалоба
                </button>
              )
            )}
            {canDelete && boardId && threadId && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="post-link text-red-700 hover:text-red-900 bg-transparent border-none p-0 inline-flex items-center gap-0.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 size={10} />
                {deleting ? 'Удаление...' : isOp ? 'Удалить тред' : 'Удалить'}
              </button>
            )}
          </div>

          {/* Content */}
          <div className="flex flex-col md:flex-row gap-4 mt-2">
            {resolvedImageUrl && post.image && (
              <div className="flex-shrink-0">
                <div className="text-[10px] text-[var(--color-muted)] mb-1 italic">
                  {attachmentIsGif ? 'GIF' : 'Файл'}: {post.image.filename || (attachmentIsGif ? 'animation.gif' : 'image')}
                  {post.image.size > 0 ? ` (${Math.max(1, Math.round(post.image.size / 1024))} KB)` : ''}
                </div>
                <button
                  type="button"
                  className="relative block bg-transparent border-none p-0 cursor-zoom-in"
                  onClick={() =>
                    setModalImage({
                      url: resolvedImageUrl,
                      filename: post.image!.filename || (attachmentIsGif ? 'animation.gif' : 'image'),
                      isGif: attachmentIsGif,
                    })
                  }
                >
                  <img
                    src={resolvedImageUrl}
                    alt={post.image.filename || 'media'}
                    className="max-w-[200px] max-h-[250px] border border-[var(--color-border)] bg-white"
                    referrerPolicy="no-referrer"
                  />
                  {attachmentIsGif && <span className="gif-badge">GIF</span>}
                </button>
                <a href={resolvedImageUrl} target="_blank" rel="noreferrer" className="post-link text-[10px] mt-1 inline-block">
                  Оригинал
                </a>
              </div>
            )}
            {post.content && (
              <div className="flex-1 whitespace-pre-wrap break-words min-w-0">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    blockquote: ({ children }) => <blockquote className="quote">{children}</blockquote>,
                    img: ({ src, alt }) => {
                      if (!src) return null;
                      const inlineGif = isGifImage(src, alt);
                      return (
                        <span className="relative inline-block my-1 align-top">
                          <img
                            src={src}
                            alt={alt || (inlineGif ? 'GIF' : 'image')}
                            referrerPolicy="no-referrer"
                            onClick={() =>
                              setModalImage({
                                url: src,
                                filename: alt || (inlineGif ? 'animation.gif' : 'image'),
                                isGif: inlineGif,
                              })
                            }
                            className="max-w-[260px] max-h-[260px] border border-[var(--color-border)] bg-white cursor-zoom-in"
                          />
                          {inlineGif && <span className="gif-badge">GIF</span>}
                        </span>
                      );
                    },
                  }}
                >
                  {formatPostContent(post.content)}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      </div>
      {showReportModal && boardId && threadId && (
        <ReportModal
          post={post}
          boardId={boardId}
          threadId={threadId}
          onClose={() => setShowReportModal(false)}
          onSubmitted={() => {
            setReported(true);
            setShowReportModal(false);
          }}
        />
      )}
      {modalImage && (
        <ImageModal
          imageUrl={modalImage.url}
          filename={modalImage.filename}
          isGif={modalImage.isGif}
          onClose={() => setModalImage(null)}
        />
      )}
    </>
  );
}

function ReportModal({
  post,
  boardId,
  threadId,
  onClose,
  onSubmitted,
}: {
  post: Post;
  boardId: string;
  threadId: string;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [preset, setPreset] = useState<string>(REPORT_PRESETS[0]);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const reason =
      preset === 'Другое'
        ? details.trim()
        : details.trim()
          ? `${preset}: ${details.trim()}`
          : preset;
    if (!reason) {
      setError('Укажите причину жалобы.');
      return;
    }

    setSubmitting(true);
    try {
      await forumService.reportPost(boardId, threadId, post.id, reason);
      onSubmitted();
    } catch (err: any) {
      setError(err?.message || 'Не удалось отправить жалобу');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[var(--color-post-bg)] border border-[var(--color-border)] shadow-md text-xs"
      >
        <div className="bg-[var(--color-accent)] text-white font-bold px-3 py-1.5 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5">
            <Flag size={12} />
            Пожаловаться на сообщение #{post.id}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="bg-transparent border-none text-white cursor-pointer p-0"
            aria-label="Закрыть"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-3 space-y-3">
          <div className="bg-[var(--color-reply-bg)] border border-[var(--color-reply-border)] p-2 space-y-1">
            <div className="text-[10px] text-[var(--color-muted)]">
              Сообщение от <strong className="text-[var(--color-post-header)]">{post.authorName || 'Аноним'}</strong> будет отправлено модератору в админ-панель:
            </div>
            <div className="text-xs line-clamp-3 break-words">
              {post.content || (post.image?.url ? `[Вложение: ${post.image.filename || 'медиа'}]` : '(пустое сообщение)')}
            </div>
          </div>

          <div>
            <div className="font-bold mb-1.5 text-[var(--color-post-header)]">Причина жалобы</div>
            <div className="flex flex-wrap gap-1.5">
              {REPORT_PRESETS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPreset(item)}
                  className={`px-2 py-1 text-[11px] border cursor-pointer ${
                    preset === item
                      ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)] font-bold'
                      : 'bg-white text-[var(--color-post-header)] border-[var(--color-border)] hover:bg-[var(--color-post-highlight)]'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-bold mb-1 text-[var(--color-post-header)]">
              Комментарий модератору {preset === 'Другое' ? '(обязательно)' : '(необязательно)'}
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={400}
              placeholder="Опишите нарушение подробнее..."
              className="w-full bg-white border border-[var(--color-border)] p-1.5 h-20 outline-none resize-none"
            />
          </div>

          {error && <div className="text-red-700 font-bold">{error}</div>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 bg-white border border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-post-highlight)]"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-3 py-1 bg-orange-700 text-white font-bold border border-orange-800 cursor-pointer hover:bg-orange-800 disabled:opacity-50"
            >
              {submitting ? 'Отправка...' : 'Отправить модератору'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function ImageModal({
  imageUrl,
  filename,
  isGif,
  onClose,
}: {
  imageUrl: string;
  filename: string;
  isGif?: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-post-bg)] border border-[var(--color-border)] p-3 max-w-[95vw] max-h-[95vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 mb-2 text-xs">
          <span className="font-bold truncate inline-flex items-center gap-1.5">
            {isGif && (
              <span className="px-1 py-0.5 text-[9px] bg-[var(--color-accent)] text-white uppercase leading-none">
                GIF
              </span>
            )}
            <span className="truncate">{filename}</span>
          </span>
          <div className="flex items-center gap-3 shrink-0">
            <a href={imageUrl} target="_blank" rel="noreferrer" className="post-link">
              Оригинал
            </a>
            <button type="button" className="post-link bg-transparent border-none p-0" onClick={onClose}>
              Закрыть
            </button>
          </div>
        </div>
        <img
          src={imageUrl}
          alt={filename}
          className="max-w-[calc(95vw-3rem)] max-h-[calc(95vh-6rem)] object-contain mx-auto border border-[var(--color-border)] bg-white"
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  );
}

function formatPostContent(text: string): string {
  // Turn >>ID lines into quotes, and auto-embed bare direct .gif URLs.
  const withQuotes = text.replace(/^>>([a-f0-9]{8})/gm, '> >>$1');
  return withQuotes.replace(
    /(^|[\s(])(https?:\/\/[^\s)<>"]+\.gif(?:\?[^\s)<>"]*)?)/gi,
    (match, prefix, url) => {
      if (prefix === '(') return match; // already inside markdown link/image
      return `${prefix}![GIF](${url})`;
    },
  );
}
