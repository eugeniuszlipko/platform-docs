import json,os,re,collections
base=os.path.expanduser('~/.claude/projects/-Users-mdr-Documents-Projects-workspace-one')
sess={'c0f37db9':'P1','b5a4f150':'P2','abadaa92':'P3','9078d147':'P4','a4b40069':'P5','80f03e28':'P6'}
SP={'meta-planning','superpowers-routing','brainstorming','writing-plans','executing-plans','subagent-driven-development','requesting-code-review','systematic-debugging','verification-before-completion'}
for f in sorted(os.listdir(base)):
    if not f.endswith('.jsonl') or f[:8] not in sess: continue
    ph=sess[f[:8]]
    turns=[];skills=[]
    seen=set()
    for line in open(base+'/'+f,errors='ignore'):
        try:d=json.loads(line)
        except:continue
        if d.get('isSidechain'):continue
        m=d.get('message')
        if not isinstance(m,dict):continue
        if d['type']=='assistant':
            k=m.get('id')
            if k and k in seen: continue
            seen.add(k);turns.append(d['timestamp'])
        if d['type']=='user':
            c=m.get('content')
            txt=''
            if isinstance(c,str):txt=c
            elif isinstance(c,list):txt=' '.join(x.get('text','') for x in c if isinstance(x,dict) and x.get('type')=='text')
            mm=re.match(r'Base directory for this skill: \S*/skills/([^/\s]+)',txt)
            if mm: skills.append((d['timestamp'],mm.group(1),len(txt)))
    tot=collections.Counter()
    for ts,name,L in skills:
        later=sum(1 for t in turns if t>ts)
        tok=L/3.5
        cost=tok*1.25+tok*0.1*later
        tot['SP' if name in SP else 'other']+=cost
        tot[('tok_SP' if name in SP else 'tok_other')]+=tok
    print(ph,'skill bodies SP: %.0fk tok, carry-cost %.2fM wt | other: %.0fk tok, %.2fM wt'%(tot['tok_SP']/1e3,tot['SP']/1e6,tot['tok_other']/1e3,tot['other']/1e6), [ (n,int(L/3.5/1000)) for _,n,L in skills])
