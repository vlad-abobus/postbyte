import { useEffect, useMemo, useRef, useState } from 'react';
import { forumService } from '../services/forumService';
import { AlertCircle, Film, Image as ImageIcon, Link2, Upload, X } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { extractFilenameFromUrl, isGifImage, isValidHttpUrl } from '../lib/utils';

interface PostFormProps {
  boardId: string;
  threadId?: string;
  onSuccess: () => void;
  onCancel?: () => void;
  isThread?: boolean;
}

export function PostForm({ boardId, threadId, onSuccess, onCancel, isThread }: PostFormProps) {
  const { user: me } = useAuth();
  const [name, setName] = useState('');
  const [postAs, setPostAs] = useState<'account' | 'anonymous' | 'custom'>('anonymous');
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [mediaMode, setMediaMode] = useState<'file' | 'gifUrl'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [gifUrl, setGifUrl] = useState('');
  const [gifPreviewError, setGifPreviewError] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [captcha, setCaptcha] = useState('');
  const [userCaptcha, setUserCaptcha] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const captchaCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    setPostAs(me ? 'account' : 'anonymous');
  }, [me]);

  useEffect(() => {
    if (!file) {
      setFilePreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setFilePreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  useEffect(() => {
    setGifPreviewError(false);
  }, [gifUrl]);

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
      const rot = Math.random() * 0.25 - 0.125;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.fillStyle = '#1b3a1b';
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    }
  }, [captcha]);

  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const attachFile = (picked: File | null) => {
    if (!picked) {
      clearFile();
      return;
    }
    setError('');
    setMediaMode('file');
    setGifUrl('');
    setFile(picked);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const pasted = item.getAsFile();
        if (pasted) {
          e.preventDefault();
          attachFile(pasted);
          return;
        }
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      attachFile(dropped);
    }
  };

  const trimmedGifUrl = gifUrl.trim();
  const hasValidGifUrl = mediaMode === 'gifUrl' && isValidHttpUrl(trimmedGifUrl);
  const fileIsGif = file ? file.type === 'image/gif' || isGifImage(undefined, file.name) : false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (userCaptcha.toUpperCase() !== captcha) {
      setError('Неверная капча');
      setCaptcha(generateCaptcha());
      setUserCaptcha('');
      return;
    }

    const hasAttachment = (mediaMode === 'file' && !!file) || (mediaMode === 'gifUrl' && !!trimmedGifUrl);
    if (!comment.trim() && !hasAttachment) {
      setError('Введите текст или прикрепите изображение / GIF');
      return;
    }

    if (mediaMode === 'gifUrl' && trimmedGifUrl) {
      if (!isValidHttpUrl(trimmedGifUrl)) {
        setError('Введите корректную http(s) ссылку на GIF или изображение');
        return;
      }
      if (gifPreviewError) {
        setError('Не удалось загрузить GIF по этой ссылке. Укажите прямую ссылку на .gif файл.');
        return;
      }
    }

    setSubmitting(true);
    try {
      let imageObj = null;
      if (mediaMode === 'file' && file) {
        setUploadProgress(0);
        imageObj = await forumService.uploadImage(file, setUploadProgress);
        setUploadProgress(null);
      } else if (mediaMode === 'gifUrl' && trimmedGifUrl) {
        imageObj = {
          url: trimmedGifUrl,
          filename: extractFilenameFromUrl(trimmedGifUrl),
          size: 0,
        };
      }

      let authorName = '';
      if (postAs === 'anonymous') authorName = 'Аноним';
      if (postAs === 'custom') authorName = name.trim() || 'Аноним';
      // postAs === 'account' -> empty string, backend assigns current username

      if (isThread) {
        await forumService.createThread(boardId, title, authorName, comment, imageObj);
      } else if (threadId) {
        await forumService.createReply(boardId, threadId, authorName, comment, imageObj);
      }

      setName('');
      setTitle('');
      setComment('');
      clearFile();
      setGifUrl('');
      setUserCaptcha('');
      setCaptcha(generateCaptcha());
      onSuccess();
    } catch (e: any) {
      setError(e.message || 'Не удалось отправить сообщение');
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      onPaste={handlePaste}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`bg-[var(--color-post-bg)] border p-2 text-xs shadow-sm transition-colors ${
        dragOver ? 'border-[var(--color-accent)] bg-[var(--color-post-highlight)]' : 'border-[var(--color-border)]'
      }`}
    >
      <div className="bg-[var(--color-accent)] text-white font-bold p-1 mb-2 flex justify-between items-center">
        <span>{isThread ? 'Новый тред' : 'Ответ в тред'}</span>
        {onCancel && <X size={14} className="cursor-pointer" onClick={onCancel} />}
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex">
          <label className="w-20 font-bold bg-[var(--color-accent)] text-white p-1 mr-1">Автор</label>
          <div className="flex-1 bg-white border border-[var(--color-border)] p-1 flex flex-wrap gap-3">
            {me && (
              <label className="inline-flex items-center gap-1">
                <input
                  type="radio"
                  name="postAs"
                  checked={postAs === 'account'}
                  onChange={() => setPostAs('account')}
                />
                <span>Аккаунт ({me.displayName || me.email})</span>
              </label>
            )}
            <label className="inline-flex items-center gap-1">
              <input
                type="radio"
                name="postAs"
                checked={postAs === 'anonymous'}
                onChange={() => setPostAs('anonymous')}
              />
              <span>Аноним</span>
            </label>
            <label className="inline-flex items-center gap-1">
              <input
                type="radio"
                name="postAs"
                checked={postAs === 'custom'}
                onChange={() => setPostAs('custom')}
              />
              <span>Свое имя</span>
            </label>
          </div>
        </div>

        {postAs === 'custom' && (
          <div className="flex">
            <label className="w-20 font-bold bg-[var(--color-accent)] text-white p-1 mr-1">Имя</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Аноним"
              className="flex-1 bg-white border border-[var(--color-border)] p-1 outline-none"
            />
          </div>
        )}

        {isThread && (
          <div className="flex">
            <label className="w-20 font-bold bg-[var(--color-accent)] text-white p-1 mr-1">Тема</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 bg-white border border-[var(--color-border)] p-1 outline-none"
            />
          </div>
        )}

        <div className="flex">
          <label className="w-20 font-bold bg-[var(--color-accent)] text-white p-1 mr-1">Текст</label>
          <div className="flex-1">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !submitting) {
                  e.preventDefault();
                  (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
                }
              }}
              placeholder="Сообщение (можно отправить только картинку или GIF)..."
              className="w-full bg-white border border-[var(--color-border)] p-1 h-24 outline-none resize-none"
            />
            <div className="text-[10px] text-[var(--color-muted)] mt-1">
              Подсказка: Ctrl+Enter — отправить, Ctrl+V или перетаскивание — прикрепить картинку / GIF.
            </div>
          </div>
        </div>

        <div className="flex">
          <label className="w-20 font-bold bg-[var(--color-accent)] text-white p-1 mr-1">Медиа</label>
          <div className="flex-1 space-y-1.5">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setMediaMode('file')}
                className={`px-2 py-0.5 text-[11px] border cursor-pointer inline-flex items-center gap-1 ${
                  mediaMode === 'file'
                    ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)] font-bold'
                    : 'bg-white text-[var(--color-post-header)] border-[var(--color-border)] hover:bg-[var(--color-post-highlight)]'
                }`}
              >
                <Upload size={11} />
                Файл / GIF
              </button>
              <button
                type="button"
                onClick={() => {
                  setMediaMode('gifUrl');
                  clearFile();
                }}
                className={`px-2 py-0.5 text-[11px] border cursor-pointer inline-flex items-center gap-1 ${
                  mediaMode === 'gifUrl'
                    ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)] font-bold'
                    : 'bg-white text-[var(--color-post-header)] border-[var(--color-border)] hover:bg-[var(--color-post-highlight)]'
                }`}
              >
                <Link2 size={11} />
                GIF по ссылке
              </button>
            </div>

            {mediaMode === 'file' ? (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => attachFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full bg-white border border-[var(--color-border)] p-1 outline-none"
                  accept="image/png,image/jpeg,image/gif,image/webp,.gif,.png,.jpg,.jpeg,.webp"
                />
                <div className="text-[10px] text-[var(--color-muted)]">
                  PNG, JPG, анимированные GIF, WebP до 15 МБ. Большие гифки загружаются частями.
                </div>

                {file && filePreviewUrl && (
                  <div className="bg-white border border-[var(--color-border)] p-1.5 flex items-start gap-2">
                    <div className="relative shrink-0">
                      <img
                        src={filePreviewUrl}
                        alt={file.name}
                        className="max-w-[110px] max-h-[90px] object-contain border border-[var(--color-border)] bg-[var(--color-board-bg)]"
                      />
                      {fileIsGif && <span className="gif-badge">GIF</span>}
                    </div>
                    <div className="flex-1 min-w-0 text-[10px] text-[var(--color-muted)] space-y-0.5">
                      <div className="font-bold text-[var(--color-post-header)] truncate flex items-center gap-1">
                        {fileIsGif ? <Film size={11} /> : <ImageIcon size={11} />}
                        <span className="truncate">{file.name}</span>
                      </div>
                      <div>{Math.max(1, Math.round(file.size / 1024))} КБ</div>
                    </div>
                    <button
                      type="button"
                      onClick={clearFile}
                      className="text-red-700 hover:text-red-900 p-0.5 cursor-pointer bg-transparent border-none"
                      title="Убрать файл"
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex gap-1">
                  <input
                    type="url"
                    value={gifUrl}
                    onChange={(e) => setGifUrl(e.target.value)}
                    placeholder="https://media.tenor.com/.../example.gif"
                    className="flex-1 bg-white border border-[var(--color-border)] p-1 outline-none"
                  />
                  {gifUrl && (
                    <button
                      type="button"
                      onClick={() => setGifUrl('')}
                      className="px-1.5 bg-white border border-[var(--color-border)] text-red-700 cursor-pointer"
                      title="Очистить ссылку"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
                <div className="text-[10px] text-[var(--color-muted)]">
                  Вставьте прямую ссылку на .gif (Tenor, Giphy, Imgur и др.).
                </div>
                {hasValidGifUrl && !gifPreviewError && (
                  <div className="bg-white border border-[var(--color-border)] p-1.5 inline-block relative">
                    <img
                      src={trimmedGifUrl}
                      alt="Предпросмотр GIF"
                      referrerPolicy="no-referrer"
                      onError={() => setGifPreviewError(true)}
                      className="max-w-[160px] max-h-[120px] object-contain border border-[var(--color-border)]"
                    />
                    <span className="gif-badge">GIF</span>
                  </div>
                )}
                {hasValidGifUrl && gifPreviewError && (
                  <div className="text-[10px] text-red-700 font-bold">
                    Предпросмотр не загрузился — проверьте, что ссылка ведёт напрямую на файл изображения / .gif.
                  </div>
                )}
              </>
            )}

            {submitting && uploadProgress !== null && (
              <div className="w-full h-1.5 bg-[var(--color-board-bg)] border border-[var(--color-border)] overflow-hidden">
                <div
                  className="h-full bg-[var(--color-accent)] transition-all duration-150"
                  style={{ width: `${Math.max(5, uploadProgress)}%` }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="w-20 font-bold bg-[var(--color-accent)] text-white p-1 mr-1">Капча</label>
          <div
            className="bg-white border border-[var(--color-border)] p-1 px-1"
            onCopy={(e) => e.preventDefault()}
          >
            <canvas ref={captchaCanvasRef} className="block select-none pointer-events-none" />
          </div>
          <input
            type="text"
            value={userCaptcha}
            onChange={(e) => setUserCaptcha(e.target.value)}
            className="w-20 bg-white border border-[var(--color-border)] p-1 outline-none uppercase"
          />
          <button
            type="submit"
            disabled={submitting}
            className="bg-[var(--color-accent)] text-white font-bold p-1 px-4 cursor-pointer hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
          >
            {submitting
              ? uploadProgress !== null
                ? `Загрузка ${uploadProgress}%`
                : 'Отправка...'
              : 'Отправить'}
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
