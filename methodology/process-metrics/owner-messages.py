import json,sys,os
base=os.path.expanduser('~/.claude/projects/-Users-mdr-Documents-Projects-workspace-one')
sid=sys.argv[1]
for f in os.listdir(base):
    if f.startswith(sid) and f.endswith('.jsonl'):
        for line in open(base+'/'+f,errors='ignore'):
            try:d=json.loads(line)
            except:continue
            if d.get('type')!='user' or d.get('isSidechain'):continue
            m=d.get('message',{});c=m.get('content')
            if isinstance(c,list):
                if any(x.get('type')=='tool_result' for x in c if isinstance(x,dict)):continue
                c=' '.join(x.get('text','') for x in c if isinstance(x,dict) and x.get('type')=='text')
            if not c or c.startswith('<') : continue
            print(d['timestamp'][5:16],'|',c.replace('\n',' ')[:int(sys.argv[2]) if len(sys.argv)>2 else 300])
