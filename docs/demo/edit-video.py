"""Assemble the Writ walkthrough at normal playback speed against the original narration.

Inputs are genuine browser recordings and local architecture artwork. No wallet
keys are read. Raw captures and the supplied original audio remain in .local/.
Set FFMPEG_PATH and FFPROBE_PATH when the tools are not on PATH.
"""
import argparse, json, math, os, shutil, subprocess, hashlib
from pathlib import Path

ROOT=Path.cwd(); WORK=ROOT/'.local/video'; OUT=ROOT/'submission'; FPS=30
parser=argparse.ArgumentParser()
parser.add_argument('--refresh',help='Rebuild only this numbered scene; other existing scene encodes are reused.')
args=parser.parse_args()
FF=os.environ.get('FFMPEG_PATH') or shutil.which('ffmpeg')
PROBE=os.environ.get('FFPROBE_PATH') or shutil.which('ffprobe')
if not FF or not PROBE: raise RuntimeError('Set FFMPEG_PATH and FFPROBE_PATH.')

def run(a):
 r=subprocess.run([FF,'-hide_banner','-loglevel','error','-y',*map(str,a)],capture_output=True,text=True)
 if r.returncode: raise RuntimeError(r.stderr[-5000:])

def probe(p):
 return json.loads(subprocess.check_output([PROBE,'-v','error','-show_format','-show_streams','-of','json',str(p)],text=True))

j=json.loads((WORK/'capture.json').read_text(encoding='utf-8-sig'))
if not j.get('finishedAt'): raise RuntimeError('Close the recording context before editing.')
a=json.loads((WORK/'audio/alignment.json').read_text())
audio=WORK/'audio/voiceover-original.mp3'; seconds=float(probe(audio)['format']['duration'])
ps=a['paragraphs']; bounds=[0]+[(p['end']+q['start'])/2 for p,q in zip(ps,ps[1:])]+[seconds]
frames=[0]+[round(t*FPS) for t in bounds[1:-1]]+[math.ceil(seconds*FPS)]
pages={p['label']:p for p in j['pages']}
scenes={s['id']:s for s in j['scenes'] if s.get('success')}
for p in pages.values():
 p['path']=ROOT/p['file']
 p['duration']=float(probe(p['path'])['format']['duration'])
 p['shift']=p['duration']-p['elapsedAtClose']

def s(name):return scenes[name]
def ev(name,label):return next(e['at'] for e in s(name)['events'] if e['label']==label)
def win(name,start,length):return (s(name)['page'],start,length)
def start(name,offset,length):return win(name,s(name)['start']+offset,length)
def event(name,label,offset,length):return win(name,ev(name,label)+offset,length)
def tail(name,length):return win(name,s(name)['end']-length,length)

cache=WORK/'encoded';cache.mkdir(exist_ok=True)
outputs=[]; timeline=[]

def cached(name,target):return bool(args.refresh and args.refresh!=name and target.exists())

def footage(name,items,count,label):
 target=cache/(name+'.mp4'); duration=count/FPS
 if not cached(name,target):
  labels={x[0] for x in items}
  if len(labels)!=1: raise RuntimeError('Use a separate edit block for each recorded page.')
  p=pages[next(iter(labels))]; shift=p['shift']
  windows=[]; remaining=duration
  for _,at,length in items:
   use=min(length,remaining)
   if use<=0:break
   absolute=at+shift
   if absolute<0 or absolute+use>p['duration']+.1:raise RuntimeError(f'Capture window outside source: {name}')
   windows.append((absolute,use));remaining-=use
  if remaining>2.0:raise RuntimeError(f'{name} needs {remaining:.2f}s more real footage; capture more instead of slowing it down.')
  lo=min(t for t,l in windows);hi=max(t+l for t,l in windows)
  filters=[]
  for i,(at,length) in enumerate(windows):filters.append(f'[0:v]trim=start={at-lo:.6f}:duration={length:.6f},setpts=PTS-STARTPTS[p{i}]')
  filters.append(''.join(f'[p{i}]' for i in range(len(windows)))+f'concat=n={len(windows)}:v=1:a=0,fps={FPS},tpad=stop_mode=clone:stop_duration={max(.2,remaining+.2):.6f},scale=1728:1080:flags=lanczos,pad=1920:1080:96:0:white,setsar=1[base]')
  filters.append('[base][1:v]overlay=0:0:format=auto,format=yuv420p[out]')
  run(['-ss',f'{lo:.6f}','-t',f'{hi-lo+.2:.6f}','-i',p['path'],'-loop','1','-i',WORK/'review'/('label-'+label+'.png'),'-filter_complex_threads','2','-filter_complex',';'.join(filters),'-map','[out]','-an','-frames:v',count,'-c:v','libx264','-preset','fast','-crf','18','-threads','4','-movflags','+faststart',target])
 outputs.append(target)
 timeline.append({'scene':name,'frames':count,'playbackSpeed':1,'kind':'genuine browser recording','sourceWindows':[{'page':page,'recordingStart':at,'seconds':length}for page,at,length in items]})
 print(json.dumps({'encoded':name,'seconds':duration}),flush=True)

def graphic(name,path,count,offset=None):
 target=cache/(name+'.mp4')
 if not cached(name,target):
  inp=['-loop','1','-framerate',FPS,'-i',path] if offset is None else ['-ss',offset,'-i',path]
  run([*inp,'-vf',f'fps={FPS},tpad=stop_mode=clone:stop_duration=12,scale=1920:1080,setsar=1,format=yuv420p','-frames:v',count,'-an','-c:v','libx264','-preset','fast','-crf','18','-threads','4','-movflags','+faststart',target])
 outputs.append(target);timeline.append({'scene':name,'frames':count,'kind':'architecture illustration' if 'arch' in name else 'brand artwork'})
 print(json.dumps({'encoded':name,'seconds':count/FPS}),flush=True)

def n(p):return frames[p]-frames[p-1]
arch=ROOT/'.local/demo-architecture'
footage('01-problem',[start('01-intro',.35,14)],n(1),'overview')
graphic('02-introducing',WORK/'review/title.png',n(2))
footage('03-overview',[start('03-overview',1.5,12)],n(3),'overview')
footage('04-testnet',[start('04-provision-mint',0,4.5)],n(4),'ada')
footage('05-create',[
 event('04-provision-mint','practice-quote',.2,4.0),
 event('04-provision-mint','practice-created',.1,2.3),
 event('04-provision-mint','mint-quote',.1,4.0),
 event('04-provision-mint','mint-complete',-1.6,3.7),
],n(5),'ada')
footage('06-grant',[
 event('05-grant','propose-ready',.3,3.0),
 event('05-grant','proposed',-.3,2.5),
 event('05-grant','accepted',-.3,1.6),
 event('05-grant','role-confirmed',.1,3.3),
],n(6),'ada')
footage('07-issue',[
 event('06-use','mint-command-ready',1.1,2.7),
 event('06-use','collectible-issued',.2,1.6),
],n(7),'ada')
# Inspect the role, then show the same NFT in the real compatible wallet.
inspect_main=round(n(8)*.69)
footage('08a-inspect',[start('07-inspect',1.9,9)],inspect_main,'ada')
footage('08b-wallet',[tail('07b-wallet',3.7)],n(8)-inspect_main,'wallet')
footage('09-delegate',[
 event('08-lend','loan-ready',.25,5.0),
 tail('08-lend',5.5),
],n(9),'ada')
footage('10-transfer',[event('09-transfer','transfer-ready',.5,4.3)],n(10),'ada')
former=round(4.0*FPS)
footage('11a-former-holder',[tail('10-former-holder',4.2)],former,'former')
footage('11b-ben',[tail('10b-ben-controls',9.0)],n(11)-former,'ben')
footage('12-profiles',[start('11-breadth',2.4,10.5)],n(12),'breadth')
footage('13-refund',[
 event('12-refused-purchase','failed-condition',-1.2,2.5),
 event('12-refused-purchase','purchase-ready',.3,2.9),
 event('12-refused-purchase','purchase-refused',.1,3.2),
 event('12-refused-purchase','purchase-refused',3.2,3.0),
 event('12-refused-purchase','refund-paid',.1,3.9),
],n(13),'ben')
sdk_graph=round(3.3*FPS)
graphic('14a-arch-sdk',arch/'Writ-architecture-preview.mp4',sdk_graph,0)
footage('14b-sdk',[
 event('13-sdk','sdk-connected',.1,2.2),
 event('13-sdk','sdk-before-send',.1,4.2),
 event('13-sdk','sdk-command-confirmed',.25,4.8),
],n(14)-sdk_graph,'example')
footage('15-handback',[
 event('14-hand-back','unwrap-ready',.15,3.0),
 event('14-hand-back','recovery-visible',-1.4,3.1),
 event('14-hand-back','retired-funds-recovered',-1.8,5.5),
],n(15),'ben')
holder=round(2.8*FPS); forwarded=round(2.5*FPS)
graphic('16a-arch-holder',arch/'Writ-architecture-preview.mp4',holder,4)
graphic('16b-arch-command',arch/'Writ-architecture-preview.mp4',forwarded,8)
graphic('16c-arch-no-keys',arch/'Writ-architecture-preview.mp4',n(16)-holder-forwarded,12)
graphic('17-arch-boundaries',arch/'5-limits.png',n(17))
graphic('18-close',WORK/'review/endcard.png',n(18))

# All encoded scene files share the same H.264 dimensions and time base.
listing=cache/'concat.txt'
listing.write_text(''.join("file '"+p.name+"'\n"for p in outputs),encoding='utf8')
visual=WORK/'Writ-visuals.mp4'
run(['-f','concat','-safe','0','-i',listing,'-map','0:v:0','-c:v','copy','-an','-movflags','+faststart',visual])
final=OUT/'Writ-demo.mp4'
# No audio filters, rate changes, volume changes, cuts or replacement narration.
# AAC encoding provides standard MP4/social-video compatibility.
run(['-i',visual,'-i',audio,'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-map_metadata','-1','-movflags','+faststart',final])
shutil.copyfile(WORK/'Writ-captions.srt',OUT/'Writ-captions.srt')
start_frame=0
for item in timeline:
 item['start']=start_frame/FPS;start_frame+=item['frames'];item['end']=start_frame/FPS
record={'originalAudioSha256':hashlib.sha256(audio.read_bytes()).hexdigest(),'audioSpeed':1,'audioTreatment':'Original narration timeline; no tempo, volume or editorial changes. AAC encoding for MP4 compatibility.','originalAudioSeconds':seconds,'videoFrames':start_frame,'videoSeconds':start_frame/FPS,'resolution':[1920,1080],'scenes':timeline,'captureAccountAliases':{'Ada':'writ-alice-mw5cm75f.testnet','Ben':'writ-bob-mw5cm75f.testnet'},'writId':j['writId'],'target':j['target'],'executor':j['executor']}
(WORK/'edit-timeline.json').write_text(json.dumps(record,indent=2))
print(json.dumps({'video':str(final),'seconds':float(probe(final)['format']['duration']),'frames':start_frame,'audioSpeed':1}),flush=True)
