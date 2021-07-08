import base64
import re
import datetime
from io import open
import os
import zlib

# Converts rust wasm files into html script tags
# Finds any .wasm files generated by wasm-pack in the pkg directory.
# Creates .wasm.html.part files which contain code to be pasted into the target
# html file.
# The exported functions are available in the browser as
# window.wasmExports.MY_FUNCTION();

# see
# https://dzone.com/articles/webassembly-wasmfiddle-and-inline-webassembly-modu
# and
# https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WebAssembly/Memory
htmlPartTemplate = """
    <script type="module" data-info="https://stackoverflow.com/a/43834063">
let l,e,t ='script',p=/(from\s+|import\s+)['"](#[\w\-]+)['"]/g;
let x='textContent',d=document, s,o;for(o of d.querySelectorAll(t+'[type=inline-module]'))l=d.createElement(t),o.id?l.id=o.id:0,l.type='module',l[x]=o[x].replace(p,(u,a,z)=>(e=d.querySelector(t+z+'[type=module][src]'))?a+`/* ${z} */'${e.src}'`:u),l.src=URL.createObjectURL(new Blob([l[x]],{type:'application/java'+t})),o.replaceWith(l)//inline
</script>

    <script type="inline-module" id="wasm_loader">

let wasm;

async function load(module, imports) {

        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };

        } else {
            return instance;
        }
}

async function init() {
var b = "";
%s
    var input = pako.inflate(base64ToUint8Array(b));
    const imports = {};

    const { instance, module } = await load(await input, imports);

    wasm = instance.exports;
    init.__wbindgen_wasm_module = module;

    return wasm;
}

export default init;

    </script>

    <script type="inline-module">
        import init from '#wasm_loader';
        init().then((exports) => {
            window.wasmExports = exports;
            // use
            // window.wasmExports.MY_FUNCTION();
        });
    </script>
"""

def convertWasmFile(location):
    # read the wasm binary
    f = open(location, "rb")
    fileBytes = []
    try:
        fileBytes = f.read()
    finally:
        f.close()
    # convert wasm binary to js
    compressed = compress(fileBytes)
    binaryArrStr = convertBytesToBase64Str(compressed)
    htmlPart = htmlPartTemplate % binaryArrStr
    # save to js file
    newLocation = location + ".html.part"
    f = open(newLocation, "w")
    f.write(htmlPart)
    f.close()
    print("wasm converted to html.part file: %s" % newLocation)

def compress(fileBytes):
    return zlib.compress(fileBytes, level=9)

def convertBytesToBase64Str(fileBytes):
    s = base64.b64encode(fileBytes).decode('ascii')
    # return s
    wrapped = "\n"
    line = "b+=\""
    for i in s:
        if len(line) >= 79:
            wrapped = wrapped + line + "\"\n"
            line = "b+=\""
        line = line + str(i)
    if len(line) > 0:
        wrapped = wrapped + line
    wrapped = wrapped + "\"\n"
    return wrapped


# Find wasm files.
# When compiled with wasm-pack these files appear in the pkg directory
# Then save the converted wasm to file pkg/<NAME>.html.part
pkgDir = "pkg"
for root, dirs, files in os.walk(pkgDir):
    for filename in files:
        name, ext = os.path.splitext(filename)
        if ext == ".wasm":
            location = os.path.join(root, filename)
            convertWasmFile(location)

# This script generates the bip39-standalone.html file.
# It removes script and style tags and replaces with the file content.
# It also adds wasm content.

htmlRootDir = "html"

indexFilename = os.path.join(htmlRootDir, "index.html")
f = open(indexFilename, "r", encoding="utf-8")
page = f.read()
f.close()

# Script tags

scriptsFinder = re.compile("""<script src="(.*)"></script>""")
scripts = scriptsFinder.findall(page)

for script in scripts:
    filename = os.path.join(htmlRootDir, script)
    s = open(filename, "r", encoding="utf-8")
    scriptContent = "<script>%s</script>" % s.read()
    s.close()
    scriptTag = """<script src="%s"></script>""" % script
    page = page.replace(scriptTag, scriptContent)




# wasm tag
# TODO a bit too much hardcoding here
f = open("pkg/threshold_crypto_wasm_bridge_bg.wasm.html.part")
wasmHtml = f.read()
f.close()
wasmTag = "<!-- autogenerated wasm will be inserted here -->"
page = page.replace(wasmTag, wasmHtml)

# Write the standalone file

standaloneFilename = 'bls-sdk.html'
f = open(standaloneFilename, 'w', encoding="utf-8")
f.write(page)
f.close()

print("%s standalone html file created" % datetime.datetime.now())
print("%s see %s" % (datetime.datetime.now(), standaloneFilename))
