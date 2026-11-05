const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const translations=JSON.parse(html.match(/const translations=([^\n]+);/)[1]);
assert.deepEqual(Object.keys(translations.en).sort(),Object.keys(translations.zh).sort());
assert.equal(translations.en.gray,'Remove gray watermark');
assert.equal(translations.zh.gray,'移除灰色水印');
for(const value of Object.values(translations.en))assert.ok(!/[\u3400-\u9fff]/.test(value),'English UI must not contain Chinese');
for(const match of html.matchAll(/data-i18n(?:-aria|-alt)?="([^"]+)"/g))for(const lang of ['en','zh'])assert.ok(translations[lang][match[1]],match[1]);
for(const match of html.matchAll(/\b(?:t|localizedError)\('([^']+)'\)/g))assert.ok(translations.en[match[1]],'missing translation '+match[1]);
const readme=fs.readFileSync(path.join(__dirname,'../README.md'),'utf8');
assert.ok(!/[\u3400-\u9fff]/.test(readme.replace('[简体中文](README.zh-CN.md)','')),'English README may only contain Chinese in the language link');
const nodes=new Map();
function node(id){if(!nodes.has(id))nodes.set(id,{dataset:{},textContent:'',value:'',attributes:{},setAttribute(key,value){this.attributes[key]=value},querySelector(){return null}});return nodes.get(id)}
const staticNode={dataset:{i18n:'brightness'},textContent:''};
const ariaNode={dataset:{i18nAria:'viewport'},setAttribute(key,value){this[key]=value}};
const altNode={dataset:{i18nAlt:'enlarged'},alt:''};
const image={alt:'',src:'blob:unchanged'};
node('result').dataset.imageKind='live';node('result').querySelector=()=>image;
node('result-size').textContent='1280 × 640 · Preparing full-resolution image';
const storage=new Map(),meta={content:''};
const document={documentElement:{lang:''},title:'',querySelector:()=>meta,
 querySelectorAll:selector=>selector==='[data-i18n]'?[staticNode]:selector==='[data-i18n-aria]'?[ariaNode]:[altNode]};
let updates=0;
const context=vm.createContext({document,navigator:{language:'zh-CN'},localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},$:node,update:()=>updates++,requestUpdate:()=>{throw Error('Language switch must not process images')}});
vm.runInContext(`var dialog={open:true,dataset:{imageKind:'adjusted',live:'true'}};`+
 html.slice(html.indexOf('const translations='),html.indexOf('const presets='))+
 html.slice(html.indexOf("let feedbackKey="),html.indexOf('function update(){')),context);
context.applyLanguage();
assert.equal(document.documentElement.lang,'en');assert.equal(staticNode.textContent,'Brightness');
context.message(context.localizedError('fileLimit'));
assert.equal(node('feedback').textContent,translations.en.fileLimit);
context.setLanguage('zh');
assert.equal(staticNode.textContent,'亮度');assert.equal(document.documentElement.lang,'zh-CN');
assert.equal(node('feedback').textContent,translations.zh.fileLimit,'existing errors translate on switch');
assert.equal(node('preview-title').textContent,translations.zh.resultTitle);
assert.equal(node('lang-zh').attributes['aria-pressed'],'true');
assert.equal(ariaNode['aria-label'],translations.zh.viewport);
context.setLanguage('en');
assert.equal(node('feedback').textContent,translations.en.fileLimit);
assert.equal(node('result-name').textContent,'Live preview');
assert.equal(node('result-size').textContent,'1280 × 640 · Preparing full-resolution image');
assert.equal(image.src,'blob:unchanged');assert.equal(storage.get('pixel-tuner-language'),'en');
assert.equal(updates,3);
context.setLanguage('unknown');assert.equal(updates,3);
console.log('PASS: translation coverage, English-only README, language controls, preference saving, dynamic preview and error translation, and no reprocessing on language switch.');

const init=html.slice(html.indexOf("let locale='en';"),html.indexOf('function t(key)'));
for(const [stored,expected] of [[undefined,'en'],['zh','zh'],['en','en'],['invalid','en']]){
 const state=vm.createContext({navigator:{language:'zh-CN'},localStorage:{getItem:()=>stored}});
 vm.runInContext(init,state);assert.equal(vm.runInContext('locale',state),expected);
}
const blocked=vm.createContext({localStorage:{getItem(){throw Error('blocked')}}});
vm.runInContext(init,blocked);assert.equal(vm.runInContext('locale',blocked),'en');
console.log('PASS: defaults to English even with a Chinese browser or blocked storage; explicit language choices are restored.');
