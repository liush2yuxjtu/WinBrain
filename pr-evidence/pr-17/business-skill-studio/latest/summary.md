# Frontend recording summary

- Target: http://127.0.0.1:3000
- Resolution: 1440x900
- Target selection mode: FRONTEND_START_COMMAND + auto-detected URL
- Final screenshot: /home/runner/work/WinBrain/WinBrain/artifacts/frontend-recording/frontend-page.png
- Video: /home/runner/work/WinBrain/WinBrain/artifacts/frontend-recording/video/b945d330ea1d57b4f86c49296b6158ed.webm

## Staged snapshots

- /home/runner/work/WinBrain/WinBrain/artifacts/frontend-recording/snapshots/00-page-loaded.png

## Console output

- [info] %cDownload the React DevTools for a better development experience: https://react.dev/link/react-devtools font-weight:bold
- [error] %c%s%c [31m[auth][error][0m MissingSecret: Please define a `secret`. Read more at https://errors.authjs.dev#missingsecret background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server  
- [error] %c%s%c     at assertConfig (webpack-internal:///(rsc)/./node_modules/@auth/core/lib/utils/assert.js:66:16)
    at Auth (webpack-internal:///(rsc)/./node_modules/@auth/core/index.js:91:95) background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server  
- [error] %c%s%c [31m[auth][error][0m MissingSecret: Please define a `secret`. Read more at https://errors.authjs.dev#missingsecret background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server  
- [error] %c%s%c     at assertConfig (webpack-internal:///(rsc)/./node_modules/@auth/core/lib/utils/assert.js:66:16)
    at Auth (webpack-internal:///(rsc)/./node_modules/@auth/core/index.js:91:95) background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server  
- [error] Failed to load resource: the server responded with a status of 404 (Not Found)
- [error] A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up. This can happen if a SSR-ed Client Component used:

- A server/client branch `if (typeof window !== 'undefined')`.
- Variable input such as `Date.now()` or `Math.random()` which changes each time it's called.
- Date formatting in a user's locale which doesn't match the server.
- External changing data without sending a snapshot of it along with the HTML.
- Invalid HTML tag nesting.

It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.

%s%s https://react.dev/link/hydration-mismatch 

  ...
    <ScrollAndFocusHandler segmentPath={[...]}>
      <InnerScrollAndFocusHandler segmentPath={[...]} focusAndScrollRef={{apply:false, ...}}>
        <ErrorBoundary errorComponent={undefined} errorStyles={undefined} errorScripts={undefined}>
          <LoadingBoundary loading={null}>
            <HTTPAccessFallbackBoundary notFound={undefined} forbidden={undefined} unauthorized={undefined}>
              <RedirectBoundary>
                <RedirectErrorBoundary router={{...}}>
                  <InnerLayoutRouter url="/login?cal..." tree={[...]} cacheNode={{lazyData:null, ...}} ...>
                    <SegmentViewNode type="page" pagePath="login/page...">
                      <SegmentTrieNode>
                      <LoginPage>
                        <main className="auth-page">
                          <section className="auth-card">
                            <div>
                            <div>
                            <form action={function loginAction} className="auth-form">
                              <div className="field">
                                <label>
                                <input
                                  id="email"
                                  name="email"
                                  type="email"
                                  autoComplete="email"
                                  required={true}
                                  placeholder="admin@example.com"
-                                 style={{caret-color:"transparent"}}
                                >
                              <div className="field">
                                <label>
                                <input
                                  id="password"
                                  name="password"
                                  type="password"
                                  autoComplete="current-password"
                                  required={true}
-                                 style={{caret-color:"transparent"}}
                                >
                              ...
                    ...
                  ...
        ...

