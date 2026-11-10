(() => {
  'use strict';
  const manifest = window.UNITY_WEB_PARTS || {files: {}};
  const urls = new Map();
  const absolute = value => new URL(String(value), document.baseURI).href;
  const resolve = value => urls.get(absolute(value)) || value;
  const nativeFetch = window.fetch.bind(window);
  // Older Unity players predate browser audio-unlock requirements.
  const NativeAudioContext = window.AudioContext || window.webkitAudioContext;
  if (NativeAudioContext) {
    const contexts = [];
    window.AudioContext = function(...args) {const context = new NativeAudioContext(...args); contexts.push(context); return context;};
    window.AudioContext.prototype = NativeAudioContext.prototype;
    Object.setPrototypeOf(window.AudioContext, NativeAudioContext);
    const resumeAudio = () => contexts.forEach(context => {if (context.state === 'suspended' || context.state === 'interrupted') context.resume().catch(() => {});});
    ['pointerdown', 'keydown', 'touchstart'].forEach(event => document.addEventListener(event, resumeAudio, {capture:true, passive:true}));
  }
  function mime(path) {
    if (/\.wasm$/i.test(path)) return 'application/wasm';
    if (/\.js$/i.test(path)) return 'text/javascript';
    return 'application/octet-stream';
  }
  async function run() {
    const status = document.createElement('div');
    status.id = 'web-parts-progress';
    status.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;z-index:2147483647;background:#181818;color:white;padding:24px;font:16px sans-serif;text-align:center';
    document.body.appendChild(status);
    const entries = Object.entries(manifest.files);
    const total = entries.reduce((n, [, file]) => n + file.size, 0);
    let loaded = 0;
    try {
      for (const [path, file] of entries) {
        const pieces = [];
        for (const part of file.parts) {
          status.textContent = `Loading game files: ${Math.floor(loaded / total * 100)}%`;
          const response = await nativeFetch(part.path);
          if (!response.ok) throw new Error(`Could not download ${part.path} (${response.status})`);
          const buffer = await response.arrayBuffer();
          if (buffer.byteLength !== part.size) throw new Error(`Incomplete game file: ${part.path}`);
          if (window.crypto && crypto.subtle) {
            const digest = await crypto.subtle.digest('SHA-256', buffer);
            const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
            if (hash !== part.sha256) throw new Error(`Damaged game file: ${part.path}`);
          }
          pieces.push(buffer); loaded += buffer.byteLength;
        }
        urls.set(absolute(path), URL.createObjectURL(new Blob(pieces, {type: mime(path)})));
      }
      window.fetch = (resource, options) => {
        if (resource instanceof Request) {
          const target = resolve(resource.url);
          return nativeFetch(target === resource.url ? resource : new Request(target, resource), options);
        }
        return nativeFetch(resolve(resource), options);
      };
      const nativeOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(...args) {args[1] = resolve(args[1]); return nativeOpen.apply(this, args);};
      const src = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
      Object.defineProperty(HTMLScriptElement.prototype, 'src', {...src, set(value) {src.set.call(this, resolve(value));}});
      const nativeSetAttribute = Element.prototype.setAttribute;
      Element.prototype.setAttribute = function(name, value) {return nativeSetAttribute.call(this, name, this.tagName === 'SCRIPT' && name.toLowerCase() === 'src' ? resolve(value) : value);};
      status.textContent = 'Starting game…';
      for (const old of document.querySelectorAll('script[type="application/x-unity-deferred"]')) {
        const script = document.createElement('script');
        for (const attribute of old.attributes) if (attribute.name !== 'type' && attribute.name !== 'data-original-type') script.setAttribute(attribute.name, attribute.value);
        script.type = old.getAttribute('data-original-type') || 'text/javascript';
        script.async = false;
        script.textContent = old.textContent;
        const ready = script.src || script.type === 'module' ? new Promise((accept, reject) => {script.onload = accept; script.onerror = () => reject(new Error('Could not start the Unity loader.'));}) : Promise.resolve();
        old.replaceWith(script); await ready;
      }
      status.remove();
    } catch (error) {
      status.textContent = error.message + '. Serve this folder over HTTP or HTTPS.';
      console.error(error);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, {once:true});
  else run();
})();
