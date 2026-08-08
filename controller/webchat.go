/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
package controller

import (
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

// webChatLobeTarget is the only upstream this same-origin web-chat proxy may
// reach. Keep it explicit to avoid turning the endpoint into an open proxy.
const webChatLobeTarget = "https://app.lobehub.com"

// WebChatLobeProxy serves LobeChat Web under our own origin so it can be
// embedded in the built-in chat page. LobeHub itself sends
// `X-Frame-Options: DENY` / `frame-ancestors 'none'`, which browsers enforce
// for cross-origin iframes; proxying through our origin keeps the content
// same-origin and strips those headers.
func WebChatLobeProxy(c *gin.Context) {
	target, err := url.Parse(webChatLobeTarget)
	if err != nil {
		c.Status(http.StatusBadGateway)
		return
	}

	proxy := httputil.NewSingleHostReverseProxy(target)
	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		// strip the /webchat/lobe prefix and forward the rest upstream
		req.URL.Path = strings.TrimPrefix(req.URL.Path, "/webchat/lobe")
		if req.URL.Path == "" {
			req.URL.Path = "/"
		}
		req.Host = target.Host
	}

	proxy.ModifyResponse = func(resp *http.Response) error {
		// Allow embedding under our origin.
		resp.Header.Del("X-Frame-Options")
		resp.Header.Del("Content-Security-Policy")
		// Keep the SPA inside our origin.
		if loc := resp.Header.Get("Location"); loc != "" {
			if strings.HasPrefix(loc, "/") && !strings.HasPrefix(loc, "/webchat/lobe") {
				resp.Header.Set("Location", "/webchat/lobe"+loc)
			}
		}
		// Rewrite root-absolute asset/API references in HTML so the proxied
		// app stays same-origin (cookies, auth and framing all work).
		if ct := resp.Header.Get("Content-Type"); strings.Contains(ct, "text/html") {
			body, readErr := io.ReadAll(resp.Body)
			if readErr != nil {
				return readErr
			}
			_ = resp.Body.Close()
			html := rewriteWebChatRootPaths(string(body))
			resp.Body = io.NopCloser(strings.NewReader(html))
			resp.ContentLength = int64(len(html))
			resp.Header.Set("Content-Length", strconv.Itoa(len(html)))
		}
		resp.Header.Set("Cache-Control", "no-store")
		return nil
	}

	proxy.ErrorHandler = func(w http.ResponseWriter, _ *http.Request, _ error) {
		w.WriteHeader(http.StatusBadGateway)
		_, _ = w.Write([]byte("webchat proxy error"))
	}

	proxy.ServeHTTP(c.Writer, c.Request)
}

// rewriteWebChatRootPaths prefixes root-absolute references with the
// same-origin proxy mount so assets/APIs resolve through our server.
func rewriteWebChatRootPaths(html string) string {
	var b strings.Builder
	b.Grow(len(html) + 64)
	for i := 0; i < len(html); {
		if html[i] == '"' || html[i] == '\'' {
			quote := html[i]
			if i+2 < len(html) && html[i+1] == '/' && html[i+2] != '/' && html[i+2] != 'w' {
				b.WriteByte(quote)
				b.WriteString("/webchat/lobe")
				i++
				continue
			}
		}
		b.WriteByte(html[i])
		i++
	}
	return b.String()
}