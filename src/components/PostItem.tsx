import ReactMarkdown from 'react-markdown';
import { Post } from '../types';
import { formatDate } from '../lib/utils';
import { MessageSquare, Flag, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import { forumService } from '../services/forumService';
import { Link } from 'react-router-dom';

interface PostItemProps {
  post: Post;
  isOp?: boolean;
  boardId?: string;
  threadId?: string;
  onDelete?: () => void;
  isPreview?: boolean;
  hideActions?: boolean;
  canDelete?: boolean;
}

export function PostItem({ post, isOp, boardId, threadId, onDelete, isPreview, hideActions, canDelete }: PostItemProps) {
  const [reporting, setReporting] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!showImageModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowImageModal(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showImageModal]);

  const handleDelete = async () => {
    if (window.confirm('Delete this post?') && boardId && threadId) {
      setDeleting(true);
      try {
        await forumService.deletePost(boardId, threadId, post.id);
        onDelete?.();
      } finally {
        setDeleting(false);
      }
    }
  };

  const handleReport = async () => {
    const reason = window.prompt('Why are you reporting this post?');
    if (reason && boardId && threadId) {
      setReporting(true);
      await forumService.reportPost(boardId, threadId, post.id, reason);
      setReporting(false);
      alert('Report submitted.');
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

  return (
    <>
    <div className={isOp ? "op-post" : "post"}>
      <div className="flex flex-col gap-1">
        {/* Header */}
        <div className={`flex items-center gap-2 text-xs flex-wrap ${isOp ? 'op-header' : ''}`}>
          {post.authorUid ? (
            <Link to={`/profile/${post.authorUid}`} className="font-bold text-[var(--color-post-header)] inline-flex items-center gap-1 hover:underline">
              {post.authorName || 'Anonymous'}
              {isStaff && <Shield size={10} className="text-[var(--color-post-header)]" />}
            </Link>
          ) : (
            <span className="font-bold text-[var(--color-post-header)] inline-flex items-center gap-1">
              {post.authorName || 'Anonymous'}
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
                Quote
              </button>
              <button 
                onClick={handleReport} 
                disabled={reporting}
                className="post-link text-orange-700 bg-transparent border-none p-0 inline-flex items-center gap-0.5 cursor-pointer disabled:opacity-50"
              >
                <Flag size={10} />
                Report
              </button>
              {canDelete && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="post-link text-red-700 bg-transparent border-none p-0 inline-flex items-center gap-0.5 cursor-pointer disabled:opacity-50"
                >
                  Delete now
                </button>
              )}
            </>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-col md:flex-row gap-4 mt-2">
          {post.image?.url && (
            <div className="flex-shrink-0">
              <div className="text-[10px] text-[var(--color-muted)] mb-1 italic">
                File: {post.image.filename} ({Math.round(post.image.size / 1024)} KB)
              </div>
              <button
                type="button"
                className="block bg-transparent border-none p-0 cursor-zoom-in"
                onClick={() => setShowImageModal(true)}
              >
                <img
                  src={post.image.url}
                  alt={post.image.filename}
                  className="max-w-[200px] max-h-[250px] border border-[var(--color-border)] bg-white"
                  referrerPolicy="no-referrer"
                />
              </button>
              <a href={post.image.url} target="_blank" rel="noreferrer" className="post-link text-[10px] mt-1 inline-block">
                Original
              </a>
            </div>
          )}
          <div className="flex-1 whitespace-pre-wrap break-words min-w-0">
             <ReactMarkdown 
               components={{
                 p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
                 blockquote: ({children}) => <blockquote className="quote">{children}</blockquote>
               }}
             >
               {parseQuotes(post.content)}
             </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
    {showImageModal && post.image?.url && (
      <ImageModal
        imageUrl={post.image.url}
        filename={post.image.filename || 'image'}
        onClose={() => setShowImageModal(false)}
      />
    )}
    </>
  );
}

function ImageModal({
  imageUrl,
  filename,
  onClose,
}: {
  imageUrl: string;
  filename: string;
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
          <span className="font-bold truncate">{filename}</span>
          <div className="flex items-center gap-3">
            <a href={imageUrl} target="_blank" rel="noreferrer" className="post-link">
              Original
            </a>
            <button type="button" className="post-link bg-transparent border-none p-0" onClick={onClose}>
              Close
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

function parseQuotes(text: string) {
  // Simple regex for >>ID quotes
  return text.replace(/^>>([a-f0-9]{8})/gm, '> >>$1');
}
