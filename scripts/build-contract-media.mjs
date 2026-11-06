// Generate the on-chain face from the same renderer used by React. No second design to drift.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
const root=new URL('../',import.meta.url);
const text=p=>readFile(new URL(p,root),'utf8');
await mkdir(new URL('artifacts/media/',root),{recursive:true});
const amounts=stripTypeScriptTypes(await text('src/utils/amounts.ts')).replaceAll('export ','');
const definitions={};for(const id of ['contract-owner','dao-council'])definitions[id]=JSON.parse(await text(`src/templates/${id}.json`));
const source=stripTypeScriptTypes((await text('src/nft/renderWritSvg.ts')).replace(/^import .*?;\r?\n/gm,''));
const module=`${amounts}\nconst svgFontCss='__FONTS__';const getTemplate=id=>(${JSON.stringify(definitions)})[id];\n${source}`;
const {renderWritSvg}=await import(`data:text/javascript;base64,${Buffer.from(module).toString('base64')}`);
const fonts=(await text('src/nft/fonts.generated.ts')).match(/export const svgFontCss\s*=\s*(".*");/s);
if(!fonts)throw new Error('Run npm run fonts:svg first');
await writeFile(new URL('artifacts/media/fonts.css',root),JSON.parse(fonts[1]));
for(const templateId of Object.keys(definitions))for(const status of ['held','listed','locked','lent']){
 const w={id:'7777777',collection:'collectionplaceholder.testnet',owner:'holderplaceholder.testnet',executor:'executorplaceholder.testnet',target:'targetplaceholder.testnet',templateId,epoch:'87654321098765432',nonce:'98765432109876543',status,price:'12345678900000000000000000000',loans:[{method:'methodplaceholder',expiresAt:'2030-01-02T03:04:00Z'}]};
 let svg=renderWritSvg(w);
 for(const [from,to] of Object.entries({'7777777':'__ID__','collectionplaceholder.testnet':'__COLLECTION__','holderplaceholder.testnet':'__HOLDER__','targetplaceholder.testnet':'__TARGET__','87654321098765432':'__EPOCH__','98765432109876543':'__NONCE__','12345.6789':'__PRICE__','2 Jan 2030, 03:04 UTC':'__EXPIRY__','methodplaceholder':'__METHOD__'}))svg=svg.replaceAll(from,to);
 await writeFile(new URL(`artifacts/media/${templateId}-${status}.svg`,root),svg);
}
console.log('Generated eight contract SVG templates and one shared font subset from the frontend renderer.');
