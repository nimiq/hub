#!/bin/bash

# add defer to script tags which are not inline (Note: That differentiaton might be unnecessary)
sed -i -e 's/<script>/<TMP-script>/g' dist/index.html
sed -i -e 's/<script/<script defer/g' dist/index.html
sed -i -e 's/<TMP-script>/<script>/g' dist/index.html
