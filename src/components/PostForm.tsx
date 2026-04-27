import { useEffect, useMemo, useRef, useState } from 'react';
import { forumService } from '../services/forumService';
import { AlertCircle, X } from 'lucide-react';
import { User } from '../types';

interface PostFormProps {
  boardId: string;
  threadId?: string;
  onSuccess: () => void;
  onCancel?: () => void;
  isThread?: boolean;
}

export function PostForm({ boardId, threadId, onSuccess, onCancel, isThread }: PostFormProps) {
  const [name, setName] = useState('');
  const [postAs, setPostAs] = useState<'account' | 'anonymous' | 'custom'>('anonymous');
  const [me, setMe] = useState<User | null>(null);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [captcha, setCaptcha] = useState('');
  const [userCaptcha, setUserCaptcha] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const captchaCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Simple static captcha for this demo
  const generateCaptcha = useMemo(() => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return () => {
      let result = '';
      for (let i = 0; i < 5; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };
  }, []);

  useEffect(() => {
    setCaptcha(generateCaptcha());
  }, [generateCaptcha]);

  useEffect(() => {
    forumService.me()
      .then((r) => {
        setMe(r.user);
        setPostAs(r.user ? 'account' : 'anonymous');
      })
      .catch(() => {
        setMe(null);
        setPostAs('anonymous');
      });
  }, []);

  useEffect(() => {
    const canvas = captchaCanvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const width = 110;
    const height = 32;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // background
    ctx.fillStyle = '#f2f4e6'; // khaki-ish
    ctx.fillRect(0, 0, width, height);

    // noise lines
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = `rgba(40, 70, 40, ${0.15 + Math.random() * 0.2})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.random() * width, Math.random() * height);
      ctx.lineTo(Math.random() * width, Math.random() * height);
      ctx.stroke();
    }

    // characters
    ctx.font = 'bold 16px "JetBrains Mono", ui-monospace, monospace';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < captcha.length; i++) {
      const ch = captcha[i];
      const x = 10 + i * 18 + Math.random() * 2;
      const y = height / 2 + (Math.random() * 6 - 3);
      const rot = (Math.random() * 0.25 - 0.125);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.fillStyle = '#1b3a1b';
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    }
  }, [captcha]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (userCaptcha.toUpperCase() !== captcha) {
      setError('Incorrect captcha');
      setCaptcha(generateCaptcha());
      setUserCaptcha('');
      return;
    }

    if (!comment.trim()) {
      setError('Comment is required');
      return;
    }

    setSubmitting(true);
    try {
      let imageObj = null;
      if (file) {
        imageObj = await forumService.uploadImage(file);
      }

      let authorName = '';
      if (postAs === 'anonymous') authorName = 'Anonymous';
      if (postAs === 'custom') authorName = name.trim() || 'Anonymous';
      // postAs === 'account' -> empty string, backend assigns current username

      if (isThread) {
        await forumService.createThread(boardId, title, authorName, comment, imageObj);
      } else if (threadId) {
        await forumService.createReply(boardId, threadId, authorName, comment, imageObj);
      }
      
      setName('');
      setTitle('');
      setComment('');
      setFile(null);
      setUserCaptcha('');
      setCaptcha(generateCaptcha());
      onSuccess();
    } catch (e: any) {
      setError(e.message || 'Failed to post');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-[var(--color-post-bg)] border border-[var(--color-border)] p-2 text-xs shadow-sm">
      <div className="bg-[var(--color-accent)] text-white font-bold p-1 mb-2 flex justify-between items-center">
        <span>{isThread ? 'New Thread' : 'Post a Reply'}</span>
        {onCancel && <X size={14} className="cursor-pointer" onClick={onCancel} />}
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex">
          <label className="w-20 font-bold bg-[var(--color-accent)] text-white p-1 mr-1">Identity</label>
          <div className="flex-1 bg-white border border-[var(--color-border)] p-1 flex flex-wrap gap-3">
            {me && (
              <label className="inline-flex items-center gap-1">
                <input
                  type="radio"
                  name="postAs"
                  checked={postAs === 'account'}
                  onChange={() => setPostAs('account')}
                />
                <span>Account ({me.displayName || me.email})</span>
              </label>
            )}
            <label className="inline-flex items-center gap-1">
              <input
                type="radio"
                name="postAs"
                checked={postAs === 'anonymous'}
                onChange={() => setPostAs('anonymous')}
              />
              <span>Anonymous</span>
            </label>
            <label className="inline-flex items-center gap-1">
              <input
                type="radio"
                name="postAs"
                checked={postAs === 'custom'}
                onChange={() => setPostAs('custom')}
              />
              <span>Custom name</span>
            </label>
          </div>
        </div>

        {postAs === 'custom' && (
          <div className="flex">
            <label className="w-20 font-bold bg-[var(--color-accent)] text-white p-1 mr-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Anonymous"
              className="flex-1 bg-white border border-[var(--color-border)] p-1 outline-none"
            />
          </div>
        )}

        {isThread && (
          <div className="flex">
            <label className="w-20 font-bold bg-[var(--color-accent)] text-white p-1 mr-1">Subject</label>
            <input 
              type="text" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              className="flex-1 bg-white border border-[var(--color-border)] p-1 outline-none"
            />
          </div>
        )}

        <div className="flex">
          <label className="w-20 font-bold bg-[var(--color-accent)] text-white p-1 mr-1">Comment</label>
          <div className="flex-1">
            <textarea 
              value={comment} 
              onChange={e => setComment(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !submitting) {
                  e.preventDefault();
                  (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
                }
              }}
              className="w-full bg-white border border-[var(--color-border)] p-1 h-24 outline-none resize-none"
            />
            <div className="text-[10px] text-[var(--color-muted)] mt-1">
              Tip: press Ctrl+Enter to post.
            </div>
          </div>
        </div>

        <div className="flex">
          <label className="w-20 font-bold bg-[var(--color-accent)] text-white p-1 mr-1">File</label>
          <input 
            type="file" 
            onChange={e => setFile(e.target.files ? e.target.files[0] : null)} 
            className="flex-1 bg-white border border-[var(--color-border)] p-1 outline-none"
            accept="image/*"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="w-20 font-bold bg-[var(--color-accent)] text-white p-1 mr-1">Captcha</label>
          <div
            className="bg-white border border-[var(--color-border)] p-1 px-1"
            onCopy={(e) => e.preventDefault()}
          >
            <canvas ref={captchaCanvasRef} className="block select-none pointer-events-none" />
          </div>
          <input 
            type="text" 
            value={userCaptcha} 
            onChange={e => setUserCaptcha(e.target.value)} 
            className="w-20 bg-white border border-[var(--color-border)] p-1 outline-none uppercase"
          />
          <button 
            type="submit" 
            disabled={submitting}
            className="bg-[var(--color-accent)] text-white font-bold p-1 px-4 cursor-pointer hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
          >
            {submitting ? '...' : 'Post'}
          </button>
        </div>

        {error && (
          <div className="mt-2 text-red-600 flex items-center gap-1 font-bold">
            <AlertCircle size={12} />
            {error}
          </div>
        )}
      </div>
    </form>
  );
}
