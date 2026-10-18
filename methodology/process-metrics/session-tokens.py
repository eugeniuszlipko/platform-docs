import json,glob,os,collections,sys
base=os.path.expanduser('~/.claude/projects/-Users-mdr-Documents-Projects-workspace-one')
def scan(path):
    r=dict(first=None,last=None,msgs=0,inp=0,cc=0,cr=0,out=0,skills=collections.Counter(),tools=collections.Counter(),prompt=None,nuser=0,agents=collections.Counter(),models=collections.Counter())
    seen=set()
    for line in open(path,errors='ignore'):
        try:d=json.loads(line)
        except: continue
        ts=d.get('timestamp')
        if ts:
            if not r['first'] or ts<r['first']:r['first']=ts
            if not r['last'] or ts>r['last']:r['last']=ts
        m=d.get('message')
        if not isinstance(m,dict):continue
        if d.get('type')=='user' and m.get('role')=='user':
            c=m.get('content')
            txt=''
            if isinstance(c,str):txt=c
            elif isinstance(c,list):
                txt=' '.join(x.get('text','') for x in c if isinstance(x,dict) and x.get('type')=='text')
            if txt and not txt.startswith('<') and not d.get('isSidechain') :
                r['nuser']+=1
                if r['prompt'] is None:r['prompt']=txt[:200]
        if d.get('type')=='assistant':
            mid=m.get('id')
            u=m.get('usage') or {}
            key=(mid,d.get('requestId'))
            first_seen = not (key in seen and mid)
            seen.add(key)
            if first_seen:
                r['msgs']+=1
                r['inp']+=u.get('input_tokens',0);r['cc']+=u.get('cache_creation_input_tokens',0);r['cr']+=u.get('cache_read_input_tokens',0);r['out']+=u.get('output_tokens',0)
                r['models'][m.get('model')]+=1
            for x in m.get('content',[]) if isinstance(m.get('content'),list) else []:
                if x.get('type')=='tool_use':
                    r['tools'][x['name']]+=1
                    if x['name']=='Skill':r['skills'][x['input'].get('skill')]+=1
                    if x['name'] in('Agent','Task'):r['agents'][x['input'].get('subagent_type','?')]+=1
    return r
out={}
for f in sorted(glob.glob(base+'/*.jsonl')):
    sid=os.path.basename(f)[:-6]
    main=scan(f)
    subs=[scan(s) for s in glob.glob(base+'/'+sid+'/subagents/*.jsonl')]
    out[sid]=(main,subs)
import pickle;pickle.dump(out,open('agg.pkl','wb'))
rows=[]
for sid,(m,subs) in out.items():
    rows.append((m['first'] or '',sid,m,subs))
rows.sort()
for first,sid,m,subs in rows:
    st=sum(s['inp'] for s in subs);sc=sum(s['cc'] for s in subs);sr=sum(s['cr'] for s in subs);so=sum(s['out'] for s in subs)
    print(sid[:8],(m['first'] or '')[:16],(m['last'] or '')[:16],'msgs',m['msgs'],'user',m['nuser'],'| main in',m['inp'],'cc',m['cc'],'cr',m['cr'],'out',m['out'],'| subs',len(subs),'cc',sc,'cr',sr,'out',so)
    print('   prompt:',(m['prompt'] or '').replace('\n',' ')[:160])
    print('   skills:',dict(m['skills']),'agents:',dict(m['agents']))
