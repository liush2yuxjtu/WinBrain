# Frontend recording summary

- Target: http://127.0.0.1:3000
- Resolution: 1440x900
- Target selection mode: FRONTEND_START_COMMAND + auto-detected URL
- Final screenshot: /home/runner/work/WinBrain/WinBrain/artifacts/frontend-recording/frontend-page.png
- Video: /home/runner/work/WinBrain/WinBrain/artifacts/frontend-recording/video/c93de15a2803dcf29ff747156fa600a8.webm

## Staged snapshots

- /home/runner/work/WinBrain/WinBrain/artifacts/frontend-recording/snapshots/00-page-loaded.png
- /home/runner/work/WinBrain/WinBrain/artifacts/frontend-recording/snapshots/01-business-skill-studio-home.png
- /home/runner/work/WinBrain/WinBrain/artifacts/frontend-recording/snapshots/02-after-chat-response.png
- /home/runner/work/WinBrain/WinBrain/artifacts/frontend-recording/snapshots/03-after-skill-draft.png

## Console output

- [info] %cDownload the React DevTools for a better development experience: https://react.dev/link/react-devtools font-weight:bold
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

- [log] [Fast Refresh] rebuilding
- [log] [Fast Refresh] done in 1434ms
- [info] %cDownload the React DevTools for a better development experience: https://react.dev/link/react-devtools font-weight:bold
- [log] [Fast Refresh] rebuilding
- [log] [Fast Refresh] done in 3427ms
- [log] [Fast Refresh] rebuilding
- [log] [Fast Refresh] done in 871ms
