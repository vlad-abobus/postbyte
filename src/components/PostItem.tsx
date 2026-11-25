import ReactMarkdown from 'react-markdown';
import { Post } from '../types';
import { formatDate, isGifImage } from '../lib/utils';
import { MessageSquare, Flag, Shield, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { forumService } from '../services/forumService';
import { Link } from 'react-router-dom';

interface PostItemProps {
  post: Post;
  isOp?: boolean;
  boardId?: string;
  threadId?: string;
  onDelete?: (info: { postId: string; deletedThread: boolean }) => void;
  isPreview?: boolean;
  hideActions?: boolean;
  canDelete?: boolean;
}

export function PostItem({ post, isOp, boardId, threadId, onDelete, isPreview, hideActions, canDelete }: PostItemProps) {
  const [reporting, setReporting] = useState(false);
  const [modalImage, setModalImage] = useState<{ url: string; filename: string; isGif: boolean } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!modalImage) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModalImage(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalImage]);

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

  const handleReport = async () => {
    const reason = window.prompt('Почему вы жалуетесь на этот пост?');
    if (reason && boardId && threadId) {
      setReporting(true);
      try {
        await forumService.reportPost(boardId, threadId, post.id, reason);
        alert('Жалоба отправлена.');
      } catch (e: any) {
        alert(e?.message || 'Не удалось отправить жалобу');
      } finally {
        setReporting(false);
      }
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
  const attachmentIsGif = isGifImage(post.image?.url, post.image?.filename);

  return (
    <>
      <div className={isOp ? 'op-post' : 'post'}>
        <div className="flex flex-col gap-1">
          {/* Header */}
          <div className={`flex items-center gap-2 text-xs flex-wrap ${isOp ? 'op-header' : ''}`}>
            {post.authorUid ? (
              <Link to={`/profile/${post.authorUid}`} className="font-bold text-[var(--color-post-header)] inline-flex items-center gap-1 hover:underline">
                {post.authorName || 'Аноним'}
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
              <>
                <button onClick={handleQuote} className="post-link bg-transparent border-none p-0 inline-flex items-center gap-0.5 cursor-pointer">
                  <MessageSquare size={10} />
                  Цитата
                </button>
                <button
                  onClick={handleReport}
                  disabled={reporting}
                  className="post-link text-orange-700 bg-transparent border-none p-0 inline-flex items-center gap-0.5 cursor-pointer disabled:opacity-50"
                >
                  <Flag size={10} />
                  Жалоба
                </button>
              </>
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
            {post.image?.url && (
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
                      url: post.image!.url,
                      filename: post.image!.filename || (attachmentIsGif ? 'animation.gif' : 'image'),
                      isGif: attachmentIsGif,
                    })
                  }
                >
                  <img
                    src={post.image.url}
                    alt={post.image.filename || 'media'}
                    className="max-w-[200px] max-h-[250px] border border-[var(--color-border)] bg-white"
                    referrerPolicy="no-referrer"
                  />
                  {attachmentIsGif && <span className="gif-badge">GIF</span>}
                </button>
                <a href={post.image.url} target="_blank" rel="noreferrer" className="post-link text-[10px] mt-1 inline-block">
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
