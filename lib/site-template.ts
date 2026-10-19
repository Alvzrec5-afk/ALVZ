/**
 * Page du site alvzrec.com, telle qu'elle était sur l'ancien compte Netlify (design inchangé).
 * Le contenu (clips, photos, coulisses, matériel, WhatsApp) vient du studio : la page le demande à
 * /api/site au chargement (version posée sur l'ancien compte, voir `siteFileForOldAccount`), ou le reçoit
 * déjà dans la page (`<!--__SITE_INLINE__-->`, version servie par /site). Ses scripts d'origine sont en
 * `type="text/plain" data-boot` et ne démarrent qu'une fois le contenu arrivé.
 * Pour changer un texte ou le design : modifier directement le HTML ci-dessous.
 */
export const SITE_HTML = String.raw`<!DOCTYPE html>
<html lang="fr">
<head>
<!--__SITE_INLINE__-->
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ALVZ REC — Vidéo et photo</title>
<meta name="description" content="ALVZ REC, réalisateur et photographe : clips officiels, mariages, baptêmes, portraits et sport.">
<meta property="og:title" content="ALVZ REC — Vidéo et photo">
<meta property="og:description" content="Clips officiels, mariages, baptêmes, portraits et sport.">
<meta property="og:image" content="https://img.youtube.com/vi/pHi5UI_UGDU/maxresdefault.jpg">
<link rel="icon" href="https://i.imgur.com/iS7tTEc.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;800;900&family=Instrument+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  /* Un viseur de caméra en ouverture, puis deux portes : Vidéo et Photo. Noir, os, rouge REC. */
  :root {
    --black: #000000;
    --surface: #131211;
    --surface2: #1C1A18;
    --line: rgba(236, 231, 223, 0.14);
    --ink-rgb: 236, 231, 223;
    --bg-rgb: 0, 0, 0;
    --bone: #ECE7DF;
    --mute: #958F86;
    --red: #E3141E;
    --red-hot: #FF2A33;
    --amber: #F2B33D;
    --display: 'Big Shoulders Display', 'Arial Narrow', sans-serif;
    --body: 'Instrument Sans', system-ui, sans-serif;
    --osd: 'IBM Plex Mono', ui-monospace, monospace;
    --gutter: clamp(16px, 4vw, 48px);
    --max: 1240px;
    color-scheme: dark;
  }
  /* Mode clair : suit le réglage du téléphone ou de l’ordinateur. Le viseur et les visionneuses restent sombres. */
  @media (prefers-color-scheme: light) {
    :root { --black: #F4F4F2; --bg-rgb: 244, 244, 242; --surface: #E9E8E4; --surface2: #DEDDD8; --ink-rgb: 20, 19, 18; --line: rgba(20, 19, 18, 0.14); --bone: #141312; --mute: #66615A; --red: #D10F1A; --red-hot: #E3141E; --amber: #A86200; color-scheme: light; }
    .hero, header:not(.scrolled), dialog { --black: #000000; --bg-rgb: 0, 0, 0; --surface: #131211; --surface2: #1C1A18; --ink-rgb: 236, 231, 223; --line: rgba(236, 231, 223, 0.14); --bone: #ECE7DF; --mute: #958F86; --red: #E3141E; --red-hot: #FF2A33; --amber: #F2B33D; color-scheme: dark; color: var(--bone); }
    header.scrolled .brand img { filter: invert(1); }
    .grain { opacity: .035; }
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }
  [hidden] { display: none !important; }
  html { scroll-behavior: smooth; -webkit-text-size-adjust: 100%; }
  body { background: var(--black); color: var(--bone); font-family: var(--body); font-size: 17px; line-height: 1.55; overflow-x: hidden; -webkit-font-smoothing: antialiased; }
  img { display: block; max-width: 100%; }
  a { color: inherit; }
  button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; }
  :focus-visible { outline: 2px solid var(--amber); outline-offset: 3px; }
  .wrap { max-width: var(--max); margin: 0 auto; padding: 0 var(--gutter); }

  .grain { position: fixed; inset: -50%; z-index: 90; pointer-events: none; opacity: .06;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    animation: grain 1s steps(4) infinite; }
  @keyframes grain { 0% { transform: translate(0,0); } 25% { transform: translate(-3%,2%); } 50% { transform: translate(2%,-3%); } 75% { transform: translate(-2%,-1%); } 100% { transform: translate(0,0); } }

  /* EN-TÊTE */
  header { position: fixed; top: 0; left: 0; right: 0; z-index: 50; transition: background .3s ease; }
  header.scrolled { background: rgba(var(--bg-rgb),.72); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
  .bar { display: flex; align-items: center; justify-content: space-between; gap: 24px; height: 72px; }
  .brand img { width: 46px; height: 46px; object-fit: contain; }
  .menu { display: flex; align-items: center; gap: clamp(14px, 2.4vw, 32px); }
  .menu nav { display: flex; gap: clamp(14px, 2.4vw, 32px); }
  .menu nav a { text-decoration: none; font-size: 15px; font-weight: 500; color: rgba(var(--ink-rgb),.75); transition: color .2s; }
  .menu nav a:hover { color: var(--bone); }
  .lang { display: flex; border: 1px solid var(--line); border-radius: 999px; padding: 3px; }
  .lang button { font-size: 12px; font-weight: 600; padding: 4px 9px; border-radius: 999px; color: var(--mute); transition: background .2s, color .2s; }
  .lang button[aria-pressed="true"] { background: var(--bone); color: var(--black); }

  /* HERO : le viseur */
  .hero { position: relative; height: 100svh; min-height: 560px; overflow: hidden; background: var(--black); }
  .reel { position: absolute; inset: 0; }
  .reel img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; transform: scale(1.12); transition: opacity 1.2s ease; }
  .reel img.on { opacity: .62; animation: drift 7s linear forwards; }
  @keyframes drift { from { transform: scale(1.12) translateX(0); } to { transform: scale(1.04) translateX(-1.5%); } }
  .hero::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(to top, rgba(0,0,0,.92) 0%, rgba(0,0,0,.35) 45%, rgba(0,0,0,.55) 100%); }
  .viewfinder { position: absolute; inset: 88px var(--gutter) 28px; z-index: 3; pointer-events: none; }
  .corner { position: absolute; width: 34px; height: 34px; border-color: rgba(var(--ink-rgb),.8); border-style: solid; border-width: 0; }
  .corner.tl { top: 0; left: 0; border-top-width: 2px; border-left-width: 2px; }
  .corner.tr { top: 0; right: 0; border-top-width: 2px; border-right-width: 2px; }
  .corner.bl { bottom: 0; left: 0; border-bottom-width: 2px; border-left-width: 2px; }
  .corner.br { bottom: 0; right: 0; border-bottom-width: 2px; border-right-width: 2px; }
  .osd { position: absolute; font-family: var(--osd); font-size: 13px; letter-spacing: .02em; color: var(--bone); display: flex; align-items: center; gap: 10px; }
  .osd.top-l { top: 16px; left: 20px; }
  .osd.top-r { top: 16px; right: 20px; color: rgba(var(--ink-rgb),.7); gap: 16px; }
  .osd.bot-r { bottom: 16px; right: 20px; color: var(--amber); }
  .rec-dot { width: 11px; height: 11px; border-radius: 50%; background: var(--red-hot); box-shadow: 0 0 12px var(--red-hot); animation: blink 1.4s steps(1) infinite; }
  @keyframes blink { 50% { opacity: .15; } }
  .center-mark { position: absolute; left: 50%; top: 50%; width: 22px; height: 22px; transform: translate(-50%,-50%); opacity: .5; }
  .center-mark::before, .center-mark::after { content: ''; position: absolute; background: var(--bone); }
  .center-mark::before { left: 50%; top: 0; bottom: 0; width: 1px; }
  .center-mark::after { top: 50%; left: 0; right: 0; height: 1px; }
  .hero-copy { position: absolute; z-index: 4; left: 0; right: 0; bottom: 0; padding: 0 calc(var(--gutter) + 20px) clamp(64px, 11vh, 110px); max-width: calc(var(--max) + 40px); margin: 0 auto; }
  .hero h1 { font-family: var(--display); font-weight: 900; text-transform: uppercase; font-size: clamp(48px, 12vw, 168px); line-height: .84; letter-spacing: -.005em; }
  .hero h1 .ln { display: block; overflow: hidden; }
  .hero h1 .ln span { display: inline-block; transform: translateY(105%); animation: rise .9s cubic-bezier(.2,.8,.2,1) forwards; }
  .hero h1 .ln:nth-child(2) span { animation-delay: .12s; }
  @keyframes rise { to { transform: translateY(0); } }
  .hero-sub { margin-top: 22px; max-width: 48ch; color: rgba(var(--ink-rgb),.82); font-size: clamp(16px, 1.6vw, 19px); opacity: 0; animation: fade .8s ease .5s forwards; }
  .hero-ctas { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 28px; opacity: 0; animation: fade .8s ease .65s forwards; }
  @keyframes fade { to { opacity: 1; } }

  .btn { display: inline-flex; align-items: center; gap: 10px; text-decoration: none; font-weight: 600; font-size: 16px; padding: 14px 24px; border-radius: 999px; white-space: nowrap; transition: transform .2s ease, background .2s ease, color .2s ease, border-color .2s ease; }
  .btn:hover { transform: translateY(-2px); }
  .btn-red { background: var(--red); color: #fff; }
  .btn-red:hover { background: var(--red-hot); }
  .btn-ghost { border: 1px solid rgba(var(--ink-rgb),.4); }
  .btn-ghost:hover { border-color: var(--bone); background: rgba(var(--ink-rgb),.08); }


  /* SECTIONS */
  section { position: relative; }
  .block { padding: clamp(88px, 13vw, 160px) 0; }
  .surface { background: var(--surface); }
  .head { display: flex; align-items: baseline; justify-content: space-between; gap: 24px; margin-bottom: clamp(36px, 6vw, 64px); }
  .head h2 { font-family: var(--display); font-weight: 800; text-transform: uppercase; font-size: clamp(52px, 9vw, 120px); line-height: .9; }
  .head h2 sup { font-family: var(--osd); font-weight: 400; font-size: 15px; color: var(--red-hot); vertical-align: top; margin-left: 8px; position: relative; top: .6em; }
  .head p { color: var(--mute); max-width: 36ch; }

  /* CLIPS */
  .clips { list-style: none; border-top: 1px solid var(--line); }
  .clip { border-bottom: 1px solid var(--line); }
  .clip button { width: 100%; text-align: left; display: grid; align-items: center; grid-template-columns: clamp(150px, 22vw, 260px) 1fr auto auto; gap: clamp(16px, 3vw, 40px); padding: clamp(18px, 2.4vw, 28px) 0; }
  .clip-thumb { width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: 4px; filter: saturate(.85); transition: transform .35s cubic-bezier(.2,.8,.2,1), filter .35s ease; }
  .clip button:hover .clip-thumb { transform: scale(1.03); filter: saturate(1.1); }
  .clip-title { font-family: var(--display); font-weight: 800; text-transform: uppercase; font-size: clamp(34px, 6.2vw, 84px); line-height: .95; transition: color .25s ease, transform .35s cubic-bezier(.2,.8,.2,1); }
  .clip-artist { color: rgba(var(--ink-rgb),.8); font-weight: 500; text-align: right; }
  .clip-kind { color: var(--mute); font-size: 14px; min-width: 9ch; text-align: right; }
  .clip button:hover .clip-title, .clip button:focus-visible .clip-title { color: var(--red-hot); transform: translateX(12px); }

  /* PHOTO */
  .filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 28px; }
  .chip { padding: 9px 16px; border-radius: 999px; border: 1px solid var(--line); font-weight: 500; font-size: 15px; color: rgba(var(--ink-rgb),.82); transition: background .2s, color .2s, border-color .2s; }
  .chip:hover { border-color: rgba(var(--ink-rgb),.5); }
  .chip[aria-pressed="true"] { background: var(--bone); color: var(--black); border-color: var(--bone); }
  .chip small { font-family: var(--osd); font-size: 11px; margin-left: 6px; opacity: .6; }
  .gallery { columns: 5 160px; column-gap: 8px; }
  .g-item { display: block; width: 100%; margin: 0 0 8px; break-inside: avoid; border-radius: 4px; overflow: hidden; background: var(--surface); position: relative; text-align: left; }
  .g-item img { width: 100%; height: auto; transition: transform .8s cubic-bezier(.2,.8,.2,1); }
  button.g-item:hover img { transform: scale(1.03); }
  .g-item .g-cat { position: absolute; left: 12px; bottom: 10px; font-size: 13px; font-weight: 600; padding: 4px 10px; border-radius: 999px; background: rgba(0,0,0,.6); color: #fff; opacity: 0; transition: opacity .25s; }
  button.g-item:hover .g-cat, button.g-item:focus-visible .g-cat { opacity: 1; }
  .ph { display: grid; place-content: center; gap: 6px; text-align: center; border: 1px dashed rgba(var(--ink-rgb),.22); background: var(--surface); color: var(--mute); padding: 16px; }
  .ph strong { font-family: var(--display); font-weight: 800; text-transform: uppercase; font-size: 30px; line-height: 1; color: rgba(var(--ink-rgb),.5); }
  .ph span { font-size: 13px; }

  /* PRESTATIONS */
  .offers { list-style: none; border-top: 1px solid var(--line); }
  .offer { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr) auto; gap: clamp(16px, 3vw, 40px); align-items: center; padding: 28px 0; border-bottom: 1px solid var(--line); }
  .offer h3 { font-family: var(--display); font-weight: 800; text-transform: uppercase; font-size: clamp(36px, 4.6vw, 60px); line-height: .95; }
  .offer-tag { display: block; margin-top: 6px; font-size: 14px; color: var(--mute); }
  .offer p { color: rgba(var(--ink-rgb),.75); max-width: 48ch; }

  /* COULISSES */
  .bts-grid { display: grid; grid-template-columns: 1.25fr 1fr; grid-template-rows: 1fr 1fr; gap: 10px; height: clamp(440px, 62vw, 760px); }
  .bts-grid figure { overflow: hidden; border-radius: 4px; background: var(--surface); }
  .bts-grid figure:first-child { grid-row: span 2; }
  .bts-grid img { width: 100%; height: 100%; object-fit: cover; transition: transform 1.2s cubic-bezier(.2,.8,.2,1); }
  .bts-grid figure:hover img { transform: scale(1.04); }

  /* MATÉRIEL */
  .kit { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: clamp(28px, 5vw, 72px); align-items: center; }
  .kit-photo { border-radius: 4px; overflow: hidden; aspect-ratio: 4/5; }
  .kit-photo img { width: 100%; height: 100%; object-fit: cover; }
  .spec { list-style: none; border-top: 1px solid var(--line); }
  .spec li { display: grid; gap: 6px; padding: 24px 0; border-bottom: 1px solid var(--line); }
  .spec .k { color: var(--mute); font-size: 15px; }
  .spec .v { font-family: var(--display); font-weight: 800; text-transform: uppercase; font-size: clamp(36px, 5.4vw, 68px); line-height: 1; }

  /* CONTACT */
  .contact { padding: clamp(110px, 16vw, 200px) 0 48px; overflow: hidden; }
  .contact h2 { font-family: var(--display); font-weight: 900; text-transform: uppercase; font-size: clamp(72px, 16vw, 230px); line-height: .82; letter-spacing: -.01em; }
  .contact h2 .q { color: var(--red); }
  .contact-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 28px; margin-top: clamp(32px, 5vw, 56px); }
  .contact-row p { max-width: 40ch; color: rgba(var(--ink-rgb),.8); font-size: 18px; }
  .socials { display: flex; gap: 10px; flex-wrap: wrap; }
  .foot { margin-top: clamp(80px, 12vw, 140px); padding-top: 22px; border-top: 1px solid var(--line); display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; color: var(--mute); font-size: 14px; }

  /* LECTEUR VIDÉO */
  dialog.player { border: 0; padding: 0; background: transparent; color: var(--bone); width: min(1100px, 94vw); max-width: none; margin: auto; }
  dialog.player::backdrop, dialog.lb::backdrop { background: rgba(0,0,0,.93); backdrop-filter: blur(6px); }
  .player-frame { aspect-ratio: 16/9; background: #000; border-radius: 6px; overflow: hidden; }
  .player-frame iframe { width: 100%; height: 100%; border: 0; display: block; }
  .player-bar { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-top: 14px; }
  .player-bar strong { font-family: var(--display); font-weight: 800; text-transform: uppercase; font-size: 26px; line-height: 1; }
  .player-bar span { color: var(--mute); font-size: 15px; }
  .player-actions { display: flex; gap: 8px; align-items: center; }
  .pill { font-size: 14px; padding: 9px 16px; border-radius: 999px; border: 1px solid var(--line); text-decoration: none; }
  .pill:hover { border-color: var(--bone); }

  /* VISIONNEUSE PHOTO */
  dialog.lb { border: 0; padding: 0; background: transparent; color: var(--bone); width: 100vw; height: 100vh; height: 100dvh; max-width: none; max-height: none; margin: 0; overflow: hidden; }
  .lb-stage { position: absolute; inset: 0; display: grid; place-items: center; padding: 64px 72px 76px; }
  .lb-stage img { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 3px; user-select: none; }
  .lb-nav { position: absolute; top: 50%; transform: translateY(-50%); width: 52px; height: 52px; border-radius: 50%; border: 1px solid var(--line); background: rgba(0,0,0,.5); display: grid; place-items: center; font-size: 22px; }
  .lb-nav:hover { border-color: var(--bone); }
  .lb-prev { left: 14px; } .lb-next { right: 14px; }
  .lb-top { position: absolute; top: 14px; left: 16px; right: 16px; display: flex; justify-content: space-between; align-items: center; gap: 16px; }
  .lb-top .count { font-family: var(--osd); font-size: 13px; color: var(--amber); }
  .lb-cap { position: absolute; left: 0; right: 0; bottom: 22px; text-align: center; font-weight: 600; }

  .reveal { opacity: 0; transform: translateY(24px); transition: opacity .8s ease, transform .8s cubic-bezier(.2,.8,.2,1); }
  .reveal.in { opacity: 1; transform: none; }


  /* ===== ANIMATIONS ===== */
  html.lenis, html.lenis body { height: auto; }
  .lenis.lenis-smooth { scroll-behavior: auto !important; }
  .lenis.lenis-stopped { overflow: hidden; }

  body::before { content: ''; position: fixed; inset: 0; z-index: 0; pointer-events: none;
    background-image: linear-gradient(rgba(var(--ink-rgb), .035) 1px, transparent 1px), linear-gradient(90deg, rgba(var(--ink-rgb), .035) 1px, transparent 1px);
    background-size: 88px 88px; }

  /* Intro : mise au point sur le logo */
  .intro { position: fixed; inset: 0; z-index: 200; display: grid; place-items: center; cursor: pointer; }
  .intro::before, .intro::after { content: ''; position: absolute; left: 0; right: 0; height: 50.5%; background: #000; z-index: 0; transition: transform .95s cubic-bezier(.76,0,.24,1); }
  .intro::before { top: 0; } .intro::after { bottom: 0; }
  .intro.out::before { transform: translateY(-100%); } .intro.out::after { transform: translateY(100%); }
  .intro-box { position: relative; z-index: 1; width: min(66vw, 360px); aspect-ratio: 4/3; display: grid; place-items: center; transition: opacity .35s ease, transform .95s cubic-bezier(.76,0,.24,1); }
  .intro.out .intro-box { opacity: 0; transform: scale(1.2); }
  .intro-box .corner { width: 26px; height: 26px; border-color: #ECE7DF; animation: cin .9s cubic-bezier(.2,.8,.2,1) both; }
  .intro-box .corner.tl { --dx: -60px; --dy: -60px; } .intro-box .corner.tr { --dx: 60px; --dy: -60px; }
  .intro-box .corner.bl { --dx: -60px; --dy: 60px; } .intro-box .corner.br { --dx: 60px; --dy: 60px; }
  @keyframes cin { from { opacity: 0; transform: translate(var(--dx), var(--dy)); } }
  .intro-logo { width: 58%; animation: focus 1.35s ease-out .25s both; }
  @keyframes focus { 0% { opacity: 0; filter: blur(18px); transform: scale(1.14); } 40% { opacity: 1; filter: blur(2px); transform: scale(.985); } 58% { filter: blur(7px); transform: scale(1.01); } 80%, 100% { opacity: 1; filter: blur(0); transform: scale(1); } }
  .intro-osd { position: absolute; font-family: var(--osd); font-size: 12px; color: #ECE7DF; display: flex; align-items: center; gap: 8px; animation: fade .4s ease .3s both; opacity: 0; }
  .intro-osd.o-tl { top: 12px; left: 14px; } .intro-osd.o-br { bottom: 12px; right: 14px; color: #F2B33D; }
  .intro-bar { position: absolute; left: 0; right: 0; bottom: -26px; height: 2px; background: rgba(236,231,223,.15); overflow: hidden; }
  .intro-bar i { display: block; height: 100%; background: #E3141E; transform-origin: left; animation: load 1.7s cubic-bezier(.6,0,.2,1) both; }
  @keyframes load { from { transform: scaleX(0); } }
  .no-intro .intro { display: none; }
  .intro-on, .intro-on body { overflow: hidden; }
  .intro-on .hero h1 .ln span, .intro-on .hero-sub, .intro-on .hero-ctas { animation-play-state: paused; }

  /* Lettres qui roulent */
  .roll { display: inline-flex; }
  .roll .ch { display: inline-block; height: 1.2em; line-height: 1.2em; overflow: hidden; vertical-align: top; }
  .roll .ch i { display: block; font-style: normal; transition: transform .45s cubic-bezier(.7,0,.2,1); }
  .roll .ch i::after { content: attr(data-c); display: block; }
  a:hover > .roll .ch i, button:hover > .roll .ch i, a:focus-visible > .roll .ch i { transform: translateY(-50%); }

  /* Bandeau */
  .band { position: relative; overflow: hidden; border-block: 1px solid var(--line); padding: 16px 0; background: var(--black); }
  .band-track { display: flex; width: max-content; animation: band 40s linear infinite; }
  .band:hover .band-track { animation-play-state: paused; }
  .band-track span { display: flex; align-items: center; gap: 44px; padding-right: 44px; white-space: nowrap; font-family: var(--display); font-weight: 800; text-transform: uppercase; font-size: clamp(20px, 2.4vw, 30px); letter-spacing: .03em; }
  .band-track span::after { content: '✦'; color: var(--red); font-size: .7em; }
  @keyframes band { to { transform: translateX(-50%); } }

  /* Clips en grandes cartes */
  .vlist { display: grid; gap: clamp(56px, 9vw, 120px); }
  .vcard { display: grid; gap: 18px; justify-items: center; text-align: center; width: 100%; }
  .vframe { position: relative; display: block; width: 100%; aspect-ratio: 16/9; overflow: hidden; border-radius: 4px; background: var(--surface2); will-change: transform; }
  .vframe img { width: 100%; height: 100%; object-fit: cover; filter: saturate(.9) brightness(.85); transition: filter .4s ease; animation: kb 16s ease-in-out infinite alternate; }
  .vcard:nth-child(even) .vframe img { animation-direction: alternate-reverse; }
  @keyframes kb { from { transform: scale(1.05) translate(0, 0); } to { transform: scale(1.18) translate(-2%, -1.5%); } }
  .vcard:hover .vframe img, .vcard:focus-visible .vframe img { filter: saturate(1.1) brightness(1); }
  .vplay { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%) scale(.9); opacity: 0; transition: opacity .3s ease, transform .3s ease; background: var(--red); color: #fff; padding: 11px 20px; border-radius: 999px; font-weight: 600; font-size: 15px; white-space: nowrap; }
  .vcard:hover .vplay, .vcard:focus-visible .vplay { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  .vmeta { display: grid; gap: 4px; justify-items: center; }
  .vmeta .clip-artist { font-family: var(--display); font-style: italic; font-weight: 600; text-transform: uppercase; letter-spacing: .16em; font-size: 15px; color: var(--mute); text-align: center; }
  .vmeta .clip-title { font-family: var(--display); font-weight: 900; text-transform: uppercase; font-size: clamp(34px, 5.4vw, 72px); line-height: .9; transition: color .25s ease; }
  .vcard:hover .clip-title, .vcard:focus-visible .clip-title { color: var(--red-hot); }
  .vmeta .clip-kind { display: block; font-size: 13px; color: var(--mute); text-align: center; min-width: 0; }

  /* Extraits YouTube en boucle dans les cartes */
  .vvid { position: absolute; inset: 0; overflow: hidden; pointer-events: none; opacity: 0; transition: opacity .8s ease; }
  .vvid.on { opacity: 1; }
  .vvid iframe { position: absolute; top: 50%; left: 50%; width: 1920px; height: 1080px; transform: translate(-50%, -50%) scale(var(--vs, .5)); transform-origin: 50% 50%; border: 0; pointer-events: none; }
  .vvid { transition: opacity .35s ease; }
  .vframe.playing img { opacity: 0; transition: opacity .8s ease; }

  /* Galerie : apparition en cascade */
  .js-anim .g-item { opacity: 0; transform: translateY(26px) scale(.97); transition: opacity .7s ease, transform .9s cubic-bezier(.2,.8,.2,1); }
  .js-anim .g-item.in { opacity: 1; transform: none; }

  /* Contact façon terminal */
  .term { font-family: var(--osd); font-size: 15px; color: var(--red-hot); margin-bottom: 18px; min-height: 1.4em; }
  .term .caret { animation: blink 1s steps(1) infinite; }

  /* Bouton flottant */
  .float-cta { position: fixed; right: 18px; bottom: calc(18px + env(safe-area-inset-bottom, 0px)); z-index: 60; display: flex; align-items: center; gap: 10px; padding: 12px 18px; border-radius: 999px; background: rgba(12,12,12,.9); color: #ECE7DF; border: 1px solid rgba(236,231,223,.18); text-decoration: none; font-weight: 600; font-size: 15px; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); transform: translateY(160%); opacity: 0; transition: transform .5s cubic-bezier(.2,.8,.2,1), opacity .3s ease, border-color .2s; }
  .float-cta.show { transform: none; opacity: 1; }
  .float-cta:hover { border-color: #ECE7DF; }
  .float-cta .rec-dot { width: 9px; height: 9px; }

  @media (max-width: 860px) {
    .menu nav { display: none; }
    .kit { grid-template-columns: 1fr; }
    .head { flex-direction: column; gap: 12px; }
    .offer { grid-template-columns: 1fr; gap: 10px; }
    .offer .btn { justify-self: start; margin-top: 6px; }
  }
  @media (max-width: 640px) {
    body { font-size: 16px; }
    .viewfinder { inset: 80px 12px 16px; }
    .osd { font-size: 11px; }
    .osd.top-r { display: none; }
    .hero-copy { padding: 0 28px 70px; }
    .clip button { grid-template-columns: 120px 1fr; gap: 14px; }
    .clip-thumb { grid-row: span 2; }
    .clip-title { font-size: clamp(28px, 9vw, 40px); }
    .clip-artist { text-align: left; font-size: 14px; }
    .clip-kind { display: none; }
    .gallery { columns: 3; column-gap: 6px; }
    .g-item { margin-bottom: 6px; }
    .g-item .g-cat { display: none; }
    .bts-grid { grid-template-columns: 1fr 1fr; grid-template-rows: 1.4fr 1fr; height: 520px; }
    .bts-grid figure:first-child { grid-column: span 2; grid-row: auto; }
    .player-bar { flex-direction: column; align-items: flex-start; }
    .lb-stage { padding: 60px 8px 70px; }
    .lb-nav { top: auto; bottom: 12px; transform: none; width: 46px; height: 46px; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
    .hero h1 .ln span { transform: none; }
    .hero-sub, .hero-ctas { opacity: 1; }
    .grain { display: none; }
  }

  /* ===== MISE EN PAGE (octobre 2026) ===== */
  /* Ordinateur : clips en grille de 3, photos sur 5 colonnes, coulisses et matériel côte à côte, bouton Réserver en haut. */
  .book { padding: 10px 18px; font-size: 14px; }
  @media (min-width: 861px) {
    .block { padding: clamp(64px, 8vw, 112px) 0; }
    .vlist { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 44px 22px; }
    .vcard { justify-items: start; text-align: left; gap: 12px; }
    .vmeta { justify-items: start; }
    .vmeta .clip-artist, .vmeta .clip-kind { text-align: left; }
    .vmeta .clip-title { font-size: clamp(26px, 2.3vw, 34px); }
    .vframe img { animation: none; }
    .gallery { columns: 5 200px; column-gap: 10px; }
    .duo { display: grid; grid-template-columns: 1.35fr 1fr; gap: 56px; align-items: start; }
    .duo .bts-grid { height: clamp(380px, 38vw, 560px); }
    .duo .kit { grid-template-columns: 1fr; gap: 24px; }
    .duo .kit-photo { aspect-ratio: 16/10; }
    .duo .spec li { padding: 16px 0; }
    .duo .spec .v { font-size: clamp(30px, 3vw, 44px); }
    .duo .head { margin-bottom: 28px; }
    .duo .head h2 { font-size: clamp(44px, 5vw, 72px); }
    .float-cta { display: none; }
  }
  /* Téléphone : clips sur une colonne mais plus serrés, titres à gauche, moins de vide entre les parties. */
  @media (max-width: 860px) {
    .book { display: none; }
    .block { padding: 72px 0; }
    .head { margin-bottom: 28px; }
    .vlist { gap: 36px; }
    .vcard { justify-items: start; text-align: left; gap: 10px; }
    .vmeta { justify-items: start; }
    .vmeta .clip-artist, .vmeta .clip-kind { text-align: left; }
    .vmeta .clip-title { font-size: clamp(28px, 8vw, 40px); }
    .duo > div + div { margin-top: 72px; }
    .contact { padding: 88px 0 40px; }
    .foot { margin-top: 64px; }
  }
</style>
</head>
<body>
<div class="grain" aria-hidden="true"></div>
<div class="intro" id="intro" aria-hidden="true">
  <div class="intro-box">
    <span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>
    <div class="intro-osd o-tl"><span class="rec-dot"></span><span>REC</span></div>
    <div class="intro-osd o-br" id="introTc">00:00:00:00</div>
    <img class="intro-logo" src="https://i.imgur.com/iS7tTEc.png" alt="">
    <div class="intro-bar"><i></i></div>
  </div>
</div>
<script>
  (function () {
    var d = document.documentElement, skip = false;
    try { skip = !!sessionStorage.getItem('alvz_intro') || window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    if (skip) { d.classList.add('no-intro'); return; }
    d.classList.add('intro-on');
    try { sessionStorage.setItem('alvz_intro', '1'); } catch (e) {}
    var el = document.getElementById('intro'), tc = document.getElementById('introTc'), done = false, t0 = performance.now();
    function p2(n) { return String(n).padStart(2, '0'); }
    (function tick(now) { if (done) return; var f = Math.max(0, Math.floor((now - t0) / 40)); tc.textContent = '00:00:' + p2(Math.floor(f / 25) % 60) + ':' + p2(f % 25); requestAnimationFrame(tick); })(t0);
    function finish() { if (done) return; done = true; el.classList.add('out'); d.classList.remove('intro-on'); setTimeout(function () { el.remove(); }, 1100); }
    setTimeout(finish, 2200);
    el.addEventListener('click', finish);
  })();
</script>

<header id="top">
  <div class="wrap bar">
    <a href="#top" class="brand" aria-label="ALVZ REC, retour en haut"><img src="https://i.imgur.com/iS7tTEc.png" alt="ALVZ REC"></a>
    <div class="menu">
      <nav aria-label="Navigation principale">
        <a href="#video" data-i18n="nav_video">Vidéo</a>
        <a href="#photo" data-i18n="nav_photo">Photo</a>
        <a href="#prestations" data-i18n="nav_offers">Prestations</a>
        <a href="#contact" data-i18n="nav_contact">Contact</a>
      </nav>
      <a class="btn btn-red book" data-wa="hello" target="_blank" rel="noopener" data-i18n="book">Réserver</a>
      <div class="lang" role="group" aria-label="Langue">
        <button type="button" data-lang="fr" aria-pressed="true">FR</button>
        <button type="button" data-lang="en" aria-pressed="false">EN</button>
        <button type="button" data-lang="pt" aria-pressed="false">PT</button>
      </div>
    </div>
  </div>
</header>

<main>
  <section class="hero" aria-label="Accueil">
    <div class="reel" id="reel" aria-hidden="true"></div>
    <div class="viewfinder" aria-hidden="true">
      <span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>
      <span class="center-mark"></span>
      <div class="osd top-l"><span class="rec-dot"></span><span>REC</span></div>
      <div class="osd top-r"><span>A7 IV</span><span>4K 25P</span><span>S-LOG3</span></div>
      <div class="osd bot-r"><span id="tc">TC 00:00:00:00</span></div>
    </div>
    <div class="hero-copy">
      <h1>
        <span class="ln"><span data-i18n="hero_l1">Chaque moment,</span></span>
        <span class="ln"><span data-i18n="hero_l2">bien cadré.</span></span>
      </h1>
      <p class="hero-sub" data-i18n="hero_sub">Réalisateur et photographe. Clips officiels, mariages, baptêmes, portraits et sport, du concept à l’image finale.</p>
      <div class="hero-ctas">
        <a href="#video" class="btn btn-red" data-i18n="cta_video">Voir les clips</a>
        <a href="#photo" class="btn btn-ghost" data-i18n="cta_photo">Voir les photos</a>
      </div>
    </div>
  </section>


  <div class="band" aria-hidden="true"><div class="band-track" id="bandTrack"></div></div>

  <section class="block" id="video">
    <div class="wrap">
      <div class="head reveal">
        <h2><span data-i18n="video_title">Vidéo</span><sup id="clipCount"></sup></h2>
        <p data-i18n="video_sub">Clique sur un titre pour le regarder ici.</p>
      </div>
      <div class="vlist" id="clipList"></div>
    </div>
  </section>

  <section class="block surface" id="photo">
    <div class="wrap">
      <div class="head reveal">
        <h2><span data-i18n="photo_title">Photo</span><sup id="photoCount"></sup></h2>
        <p data-i18n="photo_sub">Clique sur une photo pour l’agrandir.</p>
      </div>
      <div class="filters" id="filters" role="group" aria-label="Catégories"></div>
      <div class="gallery" id="gallery"></div>
    </div>
  </section>

  <section class="block" id="prestations">
    <div class="wrap">
      <div class="head reveal">
        <h2 data-i18n="offers_title">Prestations</h2>
        <p data-i18n="offers_sub">Dis-moi ce que tu prépares, je te réponds avec une proposition adaptée.</p>
      </div>
      <ul class="offers">
        <li class="offer"><div><h3 data-i18n="o_clip">Clip</h3><span class="offer-tag" data-i18n="tag_video">Vidéo</span></div><p data-i18n="o_clip_d"></p><a class="btn btn-ghost" data-wa="clip" target="_blank" rel="noopener" data-i18n="quote">Demander un devis</a></li>
        <li class="offer"><div><h3 data-i18n="o_mariage">Mariage</h3><span class="offer-tag" data-i18n="tag_photo">Photo</span></div><p data-i18n="o_mariage_d"></p><a class="btn btn-ghost" data-wa="mariage" target="_blank" rel="noopener" data-i18n="quote">Demander un devis</a></li>
        <li class="offer"><div><h3 data-i18n="o_bapteme">Baptême</h3><span class="offer-tag" data-i18n="tag_photo">Photo</span></div><p data-i18n="o_bapteme_d"></p><a class="btn btn-ghost" data-wa="bapteme" target="_blank" rel="noopener" data-i18n="quote">Demander un devis</a></li>
        <li class="offer"><div><h3 data-i18n="o_portrait">Portrait</h3><span class="offer-tag" data-i18n="tag_photo">Photo</span></div><p data-i18n="o_portrait_d"></p><a class="btn btn-ghost" data-wa="portrait" target="_blank" rel="noopener" data-i18n="quote">Demander un devis</a></li>
        <li class="offer"><div><h3 data-i18n="o_evenement">Événement</h3><span class="offer-tag" data-i18n="tag_photo">Photo</span></div><p data-i18n="o_evenement_d"></p><a class="btn btn-ghost" data-wa="evenement" target="_blank" rel="noopener" data-i18n="quote">Demander un devis</a></li>
        <li class="offer"><div><h3 data-i18n="o_sport">Sport</h3><span class="offer-tag" data-i18n="tag_photo">Photo</span></div><p data-i18n="o_sport_d"></p><a class="btn btn-ghost" data-wa="sport" target="_blank" rel="noopener" data-i18n="quote">Demander un devis</a></li>
      </ul>
    </div>
  </section>

  <section class="block surface" id="coulisses">
    <div class="wrap duo">
      <div>
        <div class="head reveal">
        <h2 data-i18n="bts_title">Coulisses</h2>
        <p data-i18n="bts_sub">Sur le plateau, entre deux prises.</p>
      </div>
      <div class="bts-grid">
        <figure><img data-slot="bts1" src="https://i.imgur.com/gMnKo9w.jpeg" alt="Tournage ALVZ REC, sur le plateau" loading="lazy"></figure>
        <figure><img data-slot="bts2" src="https://i.imgur.com/9aEFGnn.jpeg" alt="Tournage ALVZ REC, entre deux prises" loading="lazy"></figure>
        <figure><img data-slot="bts3" src="https://i.imgur.com/MCTCyM1.jpeg" alt="Tournage ALVZ REC, mise en place" loading="lazy"></figure>
      </div>
      </div>
      <div id="materiel">
        <div class="head reveal"><h2 data-i18n="kit_title">Caméras et drone</h2></div>
      <div class="kit">
        <div class="kit-photo"><img data-slot="kit" src="https://i.imgur.com/lO3nYfC.jpeg" alt="Le matériel de tournage ALVZ REC" loading="lazy"></div>
        <ul class="spec">
          <li><span class="k" data-i18n="kit_a7">Caméra plein format</span><span class="v">Sony a7 IV</span></li>
          <li><span class="k" data-i18n="kit_a67">Caméra APS-C</span><span class="v">Sony a6700</span></li>
          <li><span class="k" data-i18n="kit_drone">Drone</span><span class="v">DJI Neo 2</span></li>
        </ul>
      </div>
      </div>
    </div>
  </section>

  <section class="contact surface" id="contact">
    <div class="wrap">
      <p class="term" id="term" aria-hidden="true"><span id="termTxt"></span><span class="caret">_</span></p>
      <h2 class="reveal"><span data-i18n="contact_title">On en parle</span><span class="q">&nbsp;?</span></h2>
      <div class="contact-row">
        <p data-i18n="contact_sub">Écris-moi sur WhatsApp ou Instagram avec ta date et ton idée. Je réponds vite.</p>
        <div class="socials">
          <a class="btn btn-red" data-wa="hello" target="_blank" rel="noopener" data-i18n="contact_cta">Écrire sur WhatsApp</a>
          <a class="btn btn-ghost" href="https://www.instagram.com/alvz.rec" target="_blank" rel="noopener">Instagram</a>
          <a class="btn btn-ghost" href="https://www.tiktok.com/@alvz.rec" target="_blank" rel="noopener">TikTok</a>
        </div>
      </div>
      <div class="foot"><span>© 2026 ALVZ REC</span><span data-i18n="footer">Vidéo et photo</span></div>
    </div>
  </section>
</main>

<a class="float-cta" id="floatCta" data-wa="hello" target="_blank" rel="noopener"><span class="rec-dot"></span><span id="floatTxt">Réserver un tournage</span></a>

<dialog class="player" id="player" aria-label="Lecteur vidéo">
  <div class="player-frame" id="playerFrame"></div>
  <div class="player-bar">
    <div><strong id="playerTitle"></strong> <span id="playerArtist"></span></div>
    <div class="player-actions">
      <a class="pill" id="playerYt" href="#" target="_blank" rel="noopener" data-i18n="open_yt">Ouvrir sur YouTube</a>
      <button type="button" class="pill" id="playerClose" data-i18n="close">Fermer</button>
    </div>
  </div>
</dialog>

<dialog class="lb" id="lb" aria-label="Visionneuse photo">
  <div class="lb-stage" id="lbStage"><img id="lbImg" alt=""></div>
  <div class="lb-top"><span class="count" id="lbCount"></span><button type="button" class="pill" id="lbClose" data-i18n="close">Fermer</button></div>
  <button type="button" class="lb-nav lb-prev" id="lbPrev" aria-label="Photo précédente">‹</button>
  <button type="button" class="lb-nav lb-next" id="lbNext" aria-label="Photo suivante">›</button>
  <div class="lb-cap" id="lbCap"></div>
</dialog>

<script type="text/plain" data-boot>
  /* Contenu géré dans le studio ALVZ (Studio → Site) : clips, photos, coulisses, matériel, WhatsApp. */
  var SITE = window.SITE;
  var WA = SITE.wa;

  var CLIPS = SITE.clips;
  var PHOTOS = SITE.photos;

  var CATS = ['sport', 'portrait', 'evenement', 'bapteme', 'mariage'];

  var T = {
    fr: {
      nav_video: 'Vidéo', nav_photo: 'Photo', nav_offers: 'Prestations', nav_contact: 'Contact',
      hero_l1: 'Chaque moment,', hero_l2: 'bien cadré.',
      hero_sub: 'Réalisateur et photographe. Clips officiels, mariages, baptêmes, portraits et sport, du concept à l’image finale.',
      cta_video: 'Voir les clips', cta_photo: 'Voir les photos',
      video_title: 'Vidéo', video_sub: 'Clique sur un titre pour le regarder ici.',
      kind_clip: 'Clip officiel', kind_visualizer: 'Visualizer',
      photo_title: 'Photo', photo_sub: 'Clique sur une photo pour l’agrandir.',
      cat_all: 'Tout', cat_mariage: 'Mariage', cat_bapteme: 'Baptême', cat_portrait: 'Portrait', cat_sport: 'Sport', ph: 'Photo à venir',
      offers_title: 'Prestations', offers_sub: 'Dis-moi ce que tu prépares, je te réponds avec une proposition adaptée.',
      o_clip: 'Clip', o_mariage: 'Mariage', o_bapteme: 'Baptême', o_portrait: 'Portrait', o_sport: 'Sport',
      o_clip_d: 'Concept, tournage, montage et étalonnage, du moodboard au clip prêt pour YouTube et les réseaux.',
      o_mariage_d: 'Les préparatifs, la cérémonie, la soirée. Les moments importants et ceux que personne n’a vus.',
      o_bapteme_d: 'Une présence discrète pendant la cérémonie, puis les photos de famille.',
      o_portrait_d: 'Une séance en intérieur ou en extérieur, pour un profil, une pochette ou une marque.',
      o_sport_d: 'Matchs, entraînements et portraits d’athlètes, avec l’énergie du terrain.',
      tag_video: 'Vidéo', tag_photo: 'Photo', quote: 'Demander un devis',
      wa_hello: 'Salut ! Je viens de ton site, j’ai un projet à te proposer.',
      wa_clip: 'Salut ! Je viens de ton site, je voudrais un devis pour un clip.',
      wa_mariage: 'Salut ! Je viens de ton site, je voudrais un devis pour un mariage.',
      wa_bapteme: 'Salut ! Je viens de ton site, je voudrais un devis pour un baptême.',
      wa_portrait: 'Salut ! Je viens de ton site, je voudrais un devis pour une séance portrait.',
      wa_sport: 'Salut ! Je viens de ton site, je voudrais un devis pour des photos de sport.',
      bts_title: 'Coulisses', bts_sub: 'Sur le plateau, entre deux prises.',
      kit_title: 'Caméras et drone', kit_a7: 'Caméra plein format', kit_a67: 'Caméra APS-C', kit_drone: 'Drone',
      contact_title: 'On en parle', contact_sub: 'Écris-moi sur WhatsApp ou Instagram avec ta date et ton idée. Je réponds vite.',
      contact_cta: 'Écrire sur WhatsApp', footer: 'Vidéo et photo',
      cat_evenement: 'Événements', o_evenement: 'Événement', o_evenement_d: 'Anniversaires, soirées et fêtes de famille, avec un décor et des invités mis en valeur.',
      wa_evenement: 'Salut ! Je viens de ton site, je voudrais un devis pour un événement.',
      open_yt: 'Ouvrir sur YouTube', close: 'Fermer', book: 'Réserver'
    },
    en: {
      nav_video: 'Video', nav_photo: 'Photo', nav_offers: 'Services', nav_contact: 'Contact',
      hero_l1: 'Every moment,', hero_l2: 'framed right.',
      hero_sub: 'Director and photographer. Music videos, weddings, christenings, portraits and sport, from concept to final image.',
      cta_video: 'Watch the videos', cta_photo: 'See the photos',
      video_title: 'Video', video_sub: 'Click a title to watch it right here.',
      kind_clip: 'Official video', kind_visualizer: 'Visualizer',
      photo_title: 'Photo', photo_sub: 'Click a photo to see it full size.',
      cat_all: 'All', cat_mariage: 'Wedding', cat_bapteme: 'Christening', cat_portrait: 'Portrait', cat_sport: 'Sport', ph: 'Photo coming soon',
      offers_title: 'Services', offers_sub: 'Tell me what you are planning and I will reply with a proposal that fits.',
      o_clip: 'Music video', o_mariage: 'Wedding', o_bapteme: 'Christening', o_portrait: 'Portrait', o_sport: 'Sport',
      o_clip_d: 'Concept, shoot, edit and color grade, from moodboard to a video ready for YouTube and social media.',
      o_mariage_d: 'Getting ready, the ceremony, the party. The big moments and the ones nobody else saw.',
      o_bapteme_d: 'A discreet presence during the ceremony, then the family photos.',
      o_portrait_d: 'An indoor or outdoor session, for a profile, a cover or a brand.',
      o_sport_d: 'Games, training sessions and athlete portraits, with the energy of the field.',
      tag_video: 'Video', tag_photo: 'Photo', quote: 'Ask for a quote',
      wa_hello: 'Hi! I found your website and I have a project for you.',
      wa_clip: 'Hi! I found your website and I would like a quote for a music video.',
      wa_mariage: 'Hi! I found your website and I would like a quote for a wedding.',
      wa_bapteme: 'Hi! I found your website and I would like a quote for a christening.',
      wa_portrait: 'Hi! I found your website and I would like a quote for a portrait session.',
      wa_sport: 'Hi! I found your website and I would like a quote for sport photos.',
      bts_title: 'Behind the scenes', bts_sub: 'On set, between takes.',
      kit_title: 'Cameras and drone', kit_a7: 'Full-frame camera', kit_a67: 'APS-C camera', kit_drone: 'Drone',
      contact_title: 'Let’s talk', contact_sub: 'Message me on WhatsApp or Instagram with your date and your idea. I reply fast.',
      contact_cta: 'Message on WhatsApp', footer: 'Video and photo',
      cat_evenement: 'Events', o_evenement: 'Event', o_evenement_d: 'Birthdays, parties and family celebrations, with the setting and the guests at their best.',
      wa_evenement: 'Hi! I found your website and I would like a quote for an event.',
      open_yt: 'Open on YouTube', close: 'Close', book: 'Book'
    },
    pt: {
      nav_video: 'Vídeo', nav_photo: 'Foto', nav_offers: 'Serviços', nav_contact: 'Contacto',
      hero_l1: 'Cada momento,', hero_l2: 'bem enquadrado.',
      hero_sub: 'Realizador e fotógrafo. Clipes oficiais, casamentos, batizados, retratos e desporto, do conceito à imagem final.',
      cta_video: 'Ver os clipes', cta_photo: 'Ver as fotos',
      video_title: 'Vídeo', video_sub: 'Clica num título para o ver aqui.',
      kind_clip: 'Clipe oficial', kind_visualizer: 'Visualizer',
      photo_title: 'Foto', photo_sub: 'Clica numa foto para a ver em grande.',
      cat_all: 'Tudo', cat_mariage: 'Casamento', cat_bapteme: 'Batizado', cat_portrait: 'Retrato', cat_sport: 'Desporto', ph: 'Foto em breve',
      offers_title: 'Serviços', offers_sub: 'Diz-me o que estás a preparar e respondo com uma proposta à medida.',
      o_clip: 'Clipe', o_mariage: 'Casamento', o_bapteme: 'Batizado', o_portrait: 'Retrato', o_sport: 'Desporto',
      o_clip_d: 'Conceito, filmagem, montagem e correção de cor, do moodboard ao clipe pronto para o YouTube e as redes.',
      o_mariage_d: 'Os preparativos, a cerimónia, a festa. Os grandes momentos e os que ninguém viu.',
      o_bapteme_d: 'Uma presença discreta durante a cerimónia, e depois as fotos de família.',
      o_portrait_d: 'Uma sessão em interior ou exterior, para um perfil, uma capa ou uma marca.',
      o_sport_d: 'Jogos, treinos e retratos de atletas, com a energia do campo.',
      tag_video: 'Vídeo', tag_photo: 'Foto', quote: 'Pedir orçamento',
      wa_hello: 'Olá! Vi o teu site e tenho um projeto para te propor.',
      wa_clip: 'Olá! Vi o teu site e queria um orçamento para um clipe.',
      wa_mariage: 'Olá! Vi o teu site e queria um orçamento para um casamento.',
      wa_bapteme: 'Olá! Vi o teu site e queria um orçamento para um batizado.',
      wa_portrait: 'Olá! Vi o teu site e queria um orçamento para uma sessão de retrato.',
      wa_sport: 'Olá! Vi o teu site e queria um orçamento para fotos de desporto.',
      bts_title: 'Bastidores', bts_sub: 'No set, entre takes.',
      kit_title: 'Câmaras e drone', kit_a7: 'Câmara full frame', kit_a67: 'Câmara APS-C', kit_drone: 'Drone',
      contact_title: 'Bora falar', contact_sub: 'Escreve-me no WhatsApp ou Instagram com a data e a tua ideia. Respondo rápido.',
      contact_cta: 'Escrever no WhatsApp', footer: 'Vídeo e foto',
      cat_evenement: 'Eventos', o_evenement: 'Evento', o_evenement_d: 'Aniversários, festas e celebrações de família, com o cenário e os convidados em destaque.',
      wa_evenement: 'Olá! Vi o teu site e queria um orçamento para um evento.',
      open_yt: 'Abrir no YouTube', close: 'Fechar', book: 'Reservar'
    }
  };

  var lang = 'fr';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function thumb(id, size) { return 'https://img.youtube.com/vi/' + id + '/' + (size || 'maxresdefault') + '.jpg'; }
  function pad(n) { return String(n).padStart(2, '0'); }

  /* ----- Clips ----- */
  var list = document.getElementById('clipList');
  CLIPS.forEach(function (c, i) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'vcard'; b.dataset.index = i;
    b.setAttribute('aria-label', c.title + ', ' + c.artist);
    var f = document.createElement('span'); f.className = 'vframe';
    var m = document.createElement('img'); m.alt = ''; m.loading = i < 2 ? 'eager' : 'lazy'; m.src = thumb(c.id);
    m.onload = function () { if (m.naturalWidth <= 120) m.src = thumb(c.id, 'hqdefault'); };
    var pl = document.createElement('span'); pl.className = 'vplay';
    f.appendChild(m); f.appendChild(pl);
    var meta = document.createElement('span'); meta.className = 'vmeta';
    var a = document.createElement('em'); a.className = 'clip-artist'; a.textContent = c.artist;
    var t = document.createElement('strong'); t.className = 'clip-title'; t.textContent = c.title;
    var k = document.createElement('small'); k.className = 'clip-kind'; k.dataset.kind = c.kind;
    meta.appendChild(a); meta.appendChild(t); meta.appendChild(k);
    b.appendChild(f); b.appendChild(meta); list.appendChild(b);
  });
  document.getElementById('clipCount').textContent = pad(CLIPS.length);

  /* ----- Photos ----- */
  var gallery = document.getElementById('gallery');
  var filtersEl = document.getElementById('filters');
  var items = [];
  var shapes = ['4/5', '3/2', '1/1', '2/3', '4/5', '3/2'];
  PHOTOS.forEach(function (p) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'g-item';
    b.dataset.cat = p.cat; b.dataset.src = p.src;
    var im = document.createElement('img'); im.src = p.thumb; im.loading = 'lazy'; im.alt = '';
    var tag = document.createElement('span'); tag.className = 'g-cat'; tag.dataset.cat = p.cat;
    b.appendChild(im); b.appendChild(tag);
    gallery.appendChild(b); items.push(b);
  });
  document.getElementById('photoCount').textContent = PHOTOS.length ? pad(PHOTOS.length) : '';
  var activeCat = 'all';
  ['all'].concat(CATS).forEach(function (c) {
    var count = c === 'all' ? PHOTOS.length : PHOTOS.filter(function (p) { return p.cat === c; }).length;
    if (c !== 'all' && !count) return;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.dataset.cat = c;
    b.setAttribute('aria-pressed', String(c === 'all'));
    var l = document.createElement('span'); l.className = 'chip-label'; b.appendChild(l);
    if (count) { var sm = document.createElement('small'); sm.textContent = count; b.appendChild(sm); }
    b.addEventListener('click', function () {
      activeCat = c;
      filtersEl.querySelectorAll('.chip').forEach(function (x) { x.setAttribute('aria-pressed', String(x.dataset.cat === c)); });
      items.forEach(function (el) { el.hidden = !(c === 'all' || el.dataset.cat === c); });
    });
    filtersEl.appendChild(b);
  });

  /* ----- Visionneuse photo ----- */
  var lb = document.getElementById('lb'), lbImg = document.getElementById('lbImg');
  var view = [], vi = 0;
  function showPhoto() {
    var el = view[vi]; if (!el) return;
    lbImg.src = el.dataset.src;
    lbImg.alt = T[lang]['cat_' + el.dataset.cat];
    document.getElementById('lbCap').textContent = T[lang]['cat_' + el.dataset.cat];
    document.getElementById('lbCount').textContent = pad(vi + 1) + ' / ' + pad(view.length);
  }
  function step(d) { if (view.length < 2) return; vi = (vi + d + view.length) % view.length; showPhoto(); }
  gallery.addEventListener('click', function (e) {
    var el = e.target.closest('button.g-item'); if (!el) return;
    view = items.filter(function (x) { return !x.hidden && !x.dataset.ph; });
    vi = view.indexOf(el); showPhoto();
    if (lb.showModal) lb.showModal(); else window.open(el.dataset.src, '_blank');
  });
  document.getElementById('lbPrev').addEventListener('click', function () { step(-1); });
  document.getElementById('lbNext').addEventListener('click', function () { step(1); });
  document.getElementById('lbClose').addEventListener('click', function () { lb.close(); });
  lb.addEventListener('click', function (e) { if (e.target === lb || e.target.id === 'lbStage') lb.close(); });
  document.addEventListener('keydown', function (e) {
    if (!lb.open) return;
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
  });
  var x0 = null;
  lb.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
  });

  /* ----- Viseur : clips et photos en défilement + timecode ----- */
  var reel = document.getElementById('reel');
  var sources = [];
  var maxLen = Math.max(CLIPS.length, PHOTOS.length);
  for (var j = 0; j < maxLen; j++) {
    if (CLIPS[j]) sources.push(thumb(CLIPS[j].id));
    if (PHOTOS[j]) sources.push(PHOTOS[j].thumb);
  }
  var frames = [], cur = -1;
  function show(next) {
    if (cur >= 0) frames[cur].classList.remove('on');
    cur = next; void frames[cur].offsetWidth; frames[cur].classList.add('on');
  }
  sources.forEach(function (src) {
    var img = new Image(); img.alt = '';
    img.onload = function () {
      if (img.naturalWidth <= 400) return;
      reel.appendChild(img); frames.push(img);
      if (cur < 0) show(frames.length - 1);
    };
    img.src = src;
  });
  if (!reduce) setInterval(function () { if (frames.length > 1) show((cur + 1) % frames.length); }, 6000);
  var tcEl = document.getElementById('tc'), t0 = performance.now();
  function tick(now) {
    var f = Math.floor((now - t0) / 40);
    tcEl.textContent = 'TC ' + pad(Math.floor(f / 90000)) + ':' + pad(Math.floor(f / 1500) % 60) + ':' + pad(Math.floor(f / 25) % 60) + ':' + pad(f % 25);
    if (!reduce) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);


  /* ----- En-tête ----- */
  var header = document.querySelector('header');
  function onScroll() { header.classList.toggle('scrolled', window.scrollY > 40); }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* ----- Lecteur vidéo ----- */
  var player = document.getElementById('player'), frameBox = document.getElementById('playerFrame');
  list.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var c = CLIPS[+b.dataset.index];
    frameBox.innerHTML = '';
    var ifr = document.createElement('iframe');
    ifr.src = 'https://www.youtube-nocookie.com/embed/' + c.id + '?autoplay=1&rel=0&modestbranding=1';
    ifr.title = c.title + ', ' + c.artist;
    ifr.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; ifr.allowFullscreen = true;
    frameBox.appendChild(ifr);
    document.getElementById('playerTitle').textContent = c.title;
    document.getElementById('playerArtist').textContent = c.artist;
    document.getElementById('playerYt').href = 'https://youtu.be/' + c.id;
    if (player.showModal) player.showModal(); else window.open('https://youtu.be/' + c.id, '_blank');
  });
  player.addEventListener('close', function () { frameBox.innerHTML = ''; });
  player.addEventListener('click', function (e) { if (e.target === player) player.close(); });
  document.getElementById('playerClose').addEventListener('click', function () { player.close(); });

  /* ----- Apparition des titres ----- */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: .2 });
    document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
  } else { document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); }); }

  /* ----- Langues ----- */
  function setLang(l) {
    if (!T[l]) return;
    lang = l; var t = T[l];
    document.documentElement.lang = l;
    document.querySelectorAll('[data-i18n]').forEach(function (el) { var k = el.getAttribute('data-i18n'); if (t[k] !== undefined) el.textContent = t[k]; });
    document.querySelectorAll('.clip-kind').forEach(function (el) { el.textContent = t['kind_' + el.dataset.kind]; });
    document.querySelectorAll('.chip').forEach(function (el) { el.querySelector('.chip-label').textContent = t['cat_' + el.dataset.cat]; });
    document.querySelectorAll('.g-cat, .ph-cat').forEach(function (el) { el.textContent = t['cat_' + el.closest('.g-item').dataset.cat]; });
    document.querySelectorAll('.ph-txt').forEach(function (el) { el.textContent = t.ph; });
    document.querySelectorAll('button.g-item img').forEach(function (img) { img.alt = t['cat_' + img.parentNode.dataset.cat]; });
    document.querySelectorAll('[data-wa]').forEach(function (a) { a.href = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(t['wa_' + a.dataset.wa]); });
    document.querySelectorAll('.lang button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === l)); });
    if (lb.open) showPhoto();
    if (window.afterLang) window.afterLang(l);
    try { localStorage.setItem('alvz_lang', l); } catch (e) {}
  }
  document.querySelectorAll('.lang button').forEach(function (b) { b.addEventListener('click', function () { setLang(b.dataset.lang); }); });
  var saved = null;
  try { saved = localStorage.getItem('alvz_lang'); } catch (e) {}
  if (!saved) { var nl = (navigator.language || 'fr').slice(0, 2); saved = T[nl] ? nl : 'fr'; }
  setLang(saved);
</script>
<script src="https://unpkg.com/lenis@1.1.13/dist/lenis.min.js"></script>
<script type="text/plain" data-boot>
  (function () {
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var d = document.documentElement;
    var M = {
      fr: ['Clip officiel', 'Direction artistique', 'Tournage 4K', 'Étalonnage', 'Post-production', 'Drone', 'Mariage', 'Baptême', 'Portrait', 'Sport'],
      en: ['Music video', 'Art direction', '4K shooting', 'Color grading', 'Post-production', 'Drone', 'Wedding', 'Christening', 'Portrait', 'Sport'],
      pt: ['Clipe oficial', 'Direção artística', 'Filmagem 4K', 'Correção de cor', 'Pós-produção', 'Drone', 'Casamento', 'Batizado', 'Retrato', 'Desporto']
    };
    var TERM = { fr: '> Lancer l’enregistrement', en: '> Start recording', pt: '> Iniciar gravação' };
    var PLAY = { fr: '▶ Lire le clip', en: '▶ Play video', pt: '▶ Ver o clipe' };
    var FL = { fr: 'Réserver un tournage', en: 'Book a shoot', pt: 'Marcar filmagem' };

    function roll(el) {
      var txt = el.textContent;
      el.setAttribute('aria-label', txt);
      el.textContent = '';
      var w = document.createElement('span'); w.className = 'roll'; w.setAttribute('aria-hidden', 'true');
      Array.from(txt).forEach(function (ch, i) {
        var sp = document.createElement('span'); sp.className = 'ch';
        var it = document.createElement('i'); var c = ch === ' ' ? ' ' : ch;
        it.textContent = c; it.setAttribute('data-c', c); it.style.transitionDelay = (i * 14) + 'ms';
        sp.appendChild(it); w.appendChild(sp);
      });
      el.appendChild(w);
    }

    var track = document.getElementById('bandTrack');
    function buildBand(l) {
      track.innerHTML = '';
      var items = M[l] || M.fr;
      for (var k = 0; k < 2; k++) items.forEach(function (x) { var sp = document.createElement('span'); sp.textContent = x; track.appendChild(sp); });
    }

    var termEl = document.getElementById('termTxt'), termDone = false, termTyping = false;
    function typeTerm() {
      if (termTyping) return; termTyping = true;
      var txt = TERM[lang] || TERM.fr, i = 0;
      (function step() { termEl.textContent = txt.slice(0, ++i); if (i < txt.length) setTimeout(step, 45); else termDone = true; })();
    }

    window.afterLang = function (l) {
      document.querySelectorAll('.menu nav a, .btn').forEach(roll);
      buildBand(l);
      document.querySelectorAll('.vplay').forEach(function (p) { p.textContent = PLAY[l] || PLAY.fr; });
      document.getElementById('floatTxt').textContent = FL[l] || FL.fr;
      if (termDone) termEl.textContent = TERM[l] || TERM.fr;
    };
    window.afterLang(lang);

    if (!reduce && 'IntersectionObserver' in window) {
      var tio = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { typeTerm(); tio.disconnect(); } }); }, { threshold: .6 });
      tio.observe(document.getElementById('term'));
      d.classList.add('js-anim');
      var gio = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); gio.unobserve(e.target); } }); }, { threshold: .1 });
      document.querySelectorAll('.g-item').forEach(function (g, i) { g.style.transitionDelay = (i % 5) * 70 + 'ms'; gio.observe(g); });
    } else { termEl.textContent = TERM[lang] || TERM.fr; termDone = true; }

    var lenis = null;
    if (window.Lenis && !reduce && window.matchMedia('(pointer: fine)').matches) {
      lenis = new Lenis({ lerp: 0.085 });
      if (d.classList.contains('intro-on')) {
        lenis.stop();
        var iv = setInterval(function () { if (!d.classList.contains('intro-on')) { lenis.start(); clearInterval(iv); } }, 100);
      }
    }
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]'); if (!a) return;
      var id = a.getAttribute('href');
      var t = (id === '#' || id === '#top') ? 0 : document.querySelector(id);
      if (t === null) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(t, { offset: -40, duration: 1.4 });
      else if (t === 0) window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      else t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    });
    document.querySelectorAll('dialog').forEach(function (dl) {
      new MutationObserver(function () { if (!lenis) return; if (dl.open) lenis.stop(); else lenis.start(); }).observe(dl, { attributes: true, attributeFilter: ['open'] });
    });

    /* ----- Extraits YouTube en boucle ----- */
    var saveData = navigator.connection && navigator.connection.saveData;
    var vplayers = [];
    if (!reduce && !saveData && 'IntersectionObserver' in window) {
      var cardsEls = [].slice.call(document.querySelectorAll('.vcard'));
      var apiReady = false, pending = [];
      var LEN = 12;
      function build(card) {
        if (card.__yt) return;
        var c = CLIPS[+card.dataset.index], st = c.start || 40;
        var frame = card.querySelector('.vframe');
        var box = document.createElement('div'); box.className = 'vvid';
        box.style.setProperty('--vs', (frame.offsetWidth * 1.5 / 1920).toFixed(4));
        var holder = document.createElement('div'); box.appendChild(holder); frame.appendChild(box);
        var rec = { card: card, frame: frame, box: box, start: st, visible: true, ok: false };
        card.__yt = rec; vplayers.push(rec);
        rec.p = new YT.Player(holder, {
          videoId: c.id, host: 'https://www.youtube-nocookie.com',
          playerVars: { autoplay: 1, mute: 1, controls: 0, playsinline: 1, rel: 0, modestbranding: 1, start: st, disablekb: 1, fs: 0, iv_load_policy: 3, vq: 'hd1080' },
          events: {
            onReady: function (e) { rec.ok = true; e.target.mute(); try { e.target.setPlaybackQuality('hd1080'); } catch (x) {} if (rec.visible) e.target.playVideo(); },
            onStateChange: function (e) {
              clearTimeout(rec.tm);
              if (e.data === 1) { rec.seeking = false; rec.tm = setTimeout(function () { if (rec.visible && !document.querySelector('dialog[open]')) { box.classList.add('on'); frame.classList.add('playing'); } }, 900); }
              else if (!(e.data === 3 && rec.seeking)) { box.classList.remove('on'); frame.classList.remove('playing'); }
              if (e.data === 0) { rec.seeking = true; e.target.seekTo(st, true); e.target.playVideo(); }
            },
            onError: function () { rec.ok = false; rec.dead = true; box.remove(); frame.classList.remove('playing'); }
          }
        });
      }
      window.addEventListener('resize', function () { vplayers.forEach(function (r) { r.box.style.setProperty('--vs', (r.frame.offsetWidth * 1.5 / 1920).toFixed(4)); }); });
      var vio = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          var card = e.target, rec = card.__yt;
          if (e.isIntersecting) {
            if (!rec) { if (apiReady) build(card); else if (pending.indexOf(card) < 0) pending.push(card); }
            else { rec.visible = true; if (rec.ok) rec.p.playVideo(); }
          } else if (rec) { rec.visible = false; clearTimeout(rec.tm); rec.box.classList.remove('on'); rec.frame.classList.remove('playing'); if (rec.ok) setTimeout(function () { if (!rec.visible) rec.p.pauseVideo(); }, 380); }
        });
      }, { rootMargin: '150px 0px' });
      /* Ordinateur (grille) : l'extrait ne joue qu'au survol. Téléphone : quand la carte est à l'écran. */
      var hoverMode = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 861px)').matches;
      if (hoverMode) {
        cardsEls.forEach(function (card) {
          card.addEventListener('mouseenter', function () {
            var rec = card.__yt;
            if (!rec) { if (apiReady) build(card); else if (pending.indexOf(card) < 0) pending.push(card); }
            else { rec.visible = true; if (rec.ok) rec.p.playVideo(); }
          });
          card.addEventListener('mouseleave', function () {
            var rec = card.__yt;
            var i = pending.indexOf(card); if (i >= 0) pending.splice(i, 1);
            if (!rec) return;
            rec.visible = false; clearTimeout(rec.tm); rec.box.classList.remove('on'); rec.frame.classList.remove('playing');
            if (rec.ok) setTimeout(function () { if (!rec.visible) rec.p.pauseVideo(); }, 380);
          });
        });
      } else cardsEls.forEach(function (c) { vio.observe(c); });
      var prevReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () { if (prevReady) prevReady(); apiReady = true; pending.forEach(build); pending = []; };
      if (window.YT && window.YT.Player) { apiReady = true; }
      else { var tag = document.createElement('script'); tag.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(tag); }
      setInterval(function () {
        vplayers.forEach(function (r) {
          if (!r.ok || !r.visible || !r.p.getCurrentTime) return;
          var t = r.p.getCurrentTime();
          if (t > r.start + LEN || t < r.start - 1) { r.seeking = true; r.p.seekTo(r.start, true); }
          var stt = r.p.getPlayerState();
          if (!document.hidden && !document.querySelector('dialog[open]') && stt !== 1 && stt !== 3) { r.p.mute(); r.p.playVideo(); }
        });
      }, 400);
      document.querySelectorAll('dialog').forEach(function (dl) {
        new MutationObserver(function () {
          vplayers.forEach(function (r) { if (!r.ok) return; if (dl.open) { clearTimeout(r.tm); r.box.classList.remove('on'); r.frame.classList.remove('playing'); setTimeout(function () { r.p.pauseVideo(); }, 380); } else if (r.visible) r.p.playVideo(); });
        }).observe(dl, { attributes: true, attributeFilter: ['open'] });
      });
    }

    var hero = document.querySelector('.hero'), contact = document.getElementById('contact'), fc = document.getElementById('floatCta');
    function loop(t) {
      if (lenis) lenis.raf(t);
      var vh = window.innerHeight;
      var past = window.scrollY > hero.offsetHeight * 0.8;
      var near = contact.getBoundingClientRect().top < vh * 0.9;
      fc.classList.toggle('show', past && !near);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  })();
</script>
<script>
  /* ===== Contenu du site : géré dans le studio ALVZ (alvzgalleries.com → Studio → Site) =====
     Au chargement, la page demande les clips, les photos, les coulisses, le matériel et le numéro WhatsApp
     au studio, puis lance ses scripts (balises data-boot ci-dessus). Si le studio ne répond pas,
     elle affiche le contenu d'origine ci-dessous : le site n'est jamais vide. */
  (function () {
    var API = 'https://alvzgalleries.com/api/site';
    var FALLBACK = {
      wa: '33611329406',
      clips: [
        { id: 'pHi5UI_UGDU', artist: 'Daski FNG', title: 'Fidju di Tera', kind: 'clip', start: 40 },
        { id: 'YWIF5XziL8o', artist: 'Daski FNG', title: 'Alma Visuado', kind: 'clip', start: 40 },
        { id: 'yIZOvr_-7n4', artist: 'Fisley × Daski FNG', title: 'Lembra', kind: 'clip', start: 40 },
        { id: 'oX7wLDpBPpo', artist: 'Daski FNG', title: 'Nu ka sta para', kind: 'visualizer', start: 40 },
        { id: '9wSIkwAn3AE', artist: 'Daski FNG', title: 'Muda di Vida', kind: 'clip', start: 40 },
        { id: '9fHZkaxeRZM', artist: 'Telex WB', title: 'Kantu Bez', kind: 'clip', start: 40 }
      ],
      photos: [['dfKIEEw','sport'],['osqWt9q','evenement'],['iboRNzw','bapteme'],['NKFgPzw','portrait'],['NFhyVcJ','bapteme'],['rd92ybl','evenement'],['S6wlshq','sport'],['F2rZ3uD','bapteme'],['8S7u05M','portrait'],['kRYAi8n','sport'],['SIMNpib','evenement'],['HBITk0F','bapteme'],['K6dWFar','bapteme'],['z1gF07a','sport'],['UXzB9g8','portrait'],['VNcXr3z','evenement'],['BmN8R8B','portrait']]
        .map(function (p) { return { src: 'https://i.imgur.com/' + p[0] + '.jpeg', thumb: 'https://i.imgur.com/' + p[0] + 'h.jpeg', cat: p[1] }; })
    };
    var started = false;
    function boot(data) {
      if (started) return;
      started = true;
      if (!data || !data.clips || !data.photos) data = FALLBACK;
      if (!data.wa) data.wa = FALLBACK.wa;
      window.SITE = data;
      var slots = data.slots || {};
      document.querySelectorAll('img[data-slot]').forEach(function (im) { var src = slots[im.getAttribute('data-slot')]; if (src) im.src = src; });
      document.querySelectorAll('script[data-boot]').forEach(function (s) { var n = document.createElement('script'); n.text = s.text; document.body.appendChild(n); });
    }
    /* Page servie par le studio lui-même : le contenu est déjà là. */
    if (window.SITE_INLINE) return boot(window.SITE_INLINE);
    var timer = setTimeout(function () { boot(FALLBACK); }, 6000);
    fetch(API, { mode: 'cors' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { clearTimeout(timer); boot(d); })
      .catch(function () { clearTimeout(timer); boot(FALLBACK); });
  })();
</script>
</body>
</html>
`;
