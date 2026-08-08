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
	"time"

	"github.com/gin-gonic/gin"
)

// webChatLobeTarget is the only upstream this same-origin web-chat proxy may
// reach. Keep it explicit to avoid turning the endpoint into an open proxy.
const webChatLobeTarget = "https://app.lobehub.com"

const webChatLobeHost = "app.lobehub.com"

// retryTransport retries idempotent (body-less) requests on transient
// upstream failures. The upstream host is frequently unreachable from this
// network for a second or two, which otherwise surfaces as random 502s and a
// half-loaded embedded app.
type retryTransport struct {
	base http.RoundTripper
	max  int
}

func (t *retryTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	if t.base == nil {
		t.base = http.DefaultTransport
	}
	// Only retry body-less (idempotent) requests; replaying a consumed body
	// would corrupt POST payloads.
	if req.Body != nil {
		return t.base.RoundTrip(req)
	}
	attempts := t.max
	if attempts < 1 {
		attempts = 1
	}
	var lastErr error
	for i := 0; i < attempts; i++ {
		if i > 0 {
			time.Sleep(time.Duration(i) * 400 * time.Millisecond)
		}
		resp, err := t.base.RoundTrip(req)
		if err != nil {
			lastErr = err
			continue
		}
		if resp.StatusCode >= 500 {
			_ = resp.Body.Close()
			lastErr = io.EOF
			continue
		}
		return resp, nil
	}
	if lastErr == nil {
		lastErr = io.EOF
	}
	return nil, lastErr
}

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
	proxy.Transport = &retryTransport{max: 3}
	proxyBase := "http://" + c.Request.Host + "/webchat/lobe"
	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		// strip the /webchat/lobe prefix and forward the rest upstream
		req.URL.Path = strings.TrimPrefix(req.URL.Path, "/webchat/lobe")
		if req.URL.Path == "" {
			req.URL.Path = "/"
		}
		req.Host = target.Host
		// Force uncompressed upstream responses so ModifyResponse can rewrite
		// HTML/JS/CSS bodies; gin gzip re-compresses for the client afterwards.
		req.Header.Set("Accept-Encoding", "identity")
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
		// Rewrite absolute references to the upstream host so the proxied app
		// stays same-origin (assets, canonical redirects and auth all work).
		if ct := resp.Header.Get("Content-Type"); strings.Contains(ct, "text/html") ||
			strings.Contains(ct, "javascript") || strings.Contains(ct, "text/css") {
			body, readErr := io.ReadAll(resp.Body)
			if readErr != nil {
				return readErr
			}
			_ = resp.Body.Close()
			rewritten := rewriteWebChatUpstreamHosts(string(body), proxyBase)
			// Only rewrite root-absolute asset/API paths in HTML. Doing it in
			// JS would corrupt regular expressions such as /'/
			if strings.Contains(ct, "text/html") {
				rewritten = rewriteWebChatRootPaths(rewritten)
			}
			resp.Body = io.NopCloser(strings.NewReader(rewritten))
			resp.ContentLength = int64(len(rewritten))
			resp.Header.Set("Content-Length", strconv.Itoa(len(rewritten)))
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

// rewriteWebChatUpstreamHosts replaces absolute references to the upstream
// host with our same-origin proxy mount, keeping canonical redirects and
// API calls inside the iframe.
func rewriteWebChatUpstreamHosts(content, proxyBase string) string {
	content = strings.ReplaceAll(content, "https://"+webChatLobeHost, proxyBase)
	content = strings.ReplaceAll(content, "http://"+webChatLobeHost, proxyBase)
	content = strings.ReplaceAll(content, "//"+webChatLobeHost, proxyBase)
	return content
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
