Javascript libGlov framework
============================

* Files can be ES2015 (through Babel) or TypeScript.
* Server automatically restarts on any relevant file change
* Client automatically reloads on javascript or html change
* Client automatically dynamically reloads CSS file changes

Used SublimeText 3 packages (if using TypeScript):
* ArcticTypescript

Setup notes:
* To generate tsd.d.ts:
```
npm install -g tsd
tsd query node --action install --save
```
* to update: `tsd reinstall --save`

TODO:
* input
  * dragging?
  * auto-focus canvas
* sound
* use spine for sequencing, or leave this until later?

* TypeScript is not detecting unused var in ts_mod.ts, need a tshint?
* minify, bundle CSS
* bundle vendor .js files?
