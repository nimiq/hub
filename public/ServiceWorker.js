/*
 Based on code under the following license:
 Copyright 2016 Google Inc. All Rights Reserved.
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at
     http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/

// Intercept fetch
self.addEventListener('fetch', event => {
    // Respond to all requests with matching host, as those are the ones potentially leaking cookie data to the server.
    // See: https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy#Cross-origin_data_storage_access
    // @ts-ignore Property 'request' does not exist on type 'Event'.ts
    const requestHost = new URL(event.request.url).host;
    if (requestHost !== location.host) return;

    let headers = event.request.headers;
    // Check whether a resource specifies an integrity hash.
    if (event.request.integrity) {
        // Create a duplicate of the request headers, since these are read-only now.
        headers = new Headers(event.request.headers);
        // Drop all headers that could trigger a "304 - Not modified" HTTP response.
        // This helps to prevent Desktop Safari from being unable to verify the
        // integrity of the fetched resource due to a seemingly empty response... :-/
        // Note that currently, the ServiceWorker is only installed for Safari, therefore
        // we don't need to check for the browser here to apply this fix selectively for
        // Safari only.
        // TODO: check in the future whether Safari still needs this special treatment
        headers.delete('If-Match');
        headers.delete('If-None-Match');
        headers.delete('If-Modified-Since');
        headers.delete('If-Unmodified-Since');
    }

    // forward request
    // @ts-ignore Property 'respondWith' does not exist on type 'Event'.ts,
    // Property 'request' does not exist on type 'Event'.ts
    event.respondWith(fetch(event.request, {
        // omit cookie transmission
        credentials: 'omit',
        // override headers as they might have changed
        headers,
    }));
});
