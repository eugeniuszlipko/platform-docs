import subprocess,re,os,json,collections
R='/Users/mdr/Documents/Projects/workspace-one/'
ranges={
 'urban.gardener':{'P1':('02f21f1','02f21f1'),'P2':('2dabef8','2dabef8'),'P3':('83eea3c','df95032'),'P4':('8c45559','1c20668'),'P5':('e13f88c','001c708'),'P6':('6615ef1','928bcbf')},
 'web.admin':{'P2':('53b5953','53b5953'),'P3':('c35379b','f2d11b2'),'P4':('26909bc','e5c5cab'),'P5':('371c3fc','a245268')},
}
istest=lambda p: re.search(r'(\.test\.|\.spec\.|/e2e/|__tests__)',p)
res=collections.defaultdict(lambda: collections.Counter())
filesets={}
for repo,rs in ranges.items():
    for ph,(a,b) in rs.items():
        out=subprocess.run(['git','-C',R+repo,'diff','--name-status',a+'^',b],capture_output=True,text=True).stdout
        files=[l.split('\t')[-1] for l in out.splitlines() if l[0] in 'AM']
        files=[f for f in files if f.endswith(('.ts','.tsx')) and os.path.exists(R+repo+'/'+f)]
        filesets[(repo,ph)]=files
        c=res[ph]
        for f in files:
            txt=open(R+repo+'/'+f,errors='ignore').read()
            loc=len([l for l in txt.split('\n') if l.strip()])
            if istest(f):
                c['t_files']+=1;c['t_loc']+=loc
                cases=len(re.findall(r'^\s*(?:it|test)(?:\.each\([^)]*\))?\(',txt,re.M))
                c['t_cases']+=cases
                c['t_expect']+=len(re.findall(r'\bexpect\(',txt))
                c['t_role']+=len(re.findall(r'getByRole|findByRole|getAllByRole|queryByRole|axe',txt))
                c['t_err']+=len(re.findall(r'(?i)\b(it|test)\(\s*[\'"`][^\'"`]*(error|fail|throw|reject|invalid|empty|missing|unknown|404|draft|unpublished|offline|truncat|denied|anon)',txt))
                c['t_skip']+=len(re.findall(r'\.(skip|todo|fixme)\(',txt))
                c['t_e2e']+= 1 if '/e2e/' in f else 0
                c['t_mock']+=len(re.findall(r'vi\.(mock|fn|spyOn)\(',txt))
            else:
                if '/supabase/' in f or f.endswith('.d.ts'): continue
                c['s_files']+=1;c['s_loc']+=loc
                c['s_big']+= 1 if loc>300 else 0
                c['s_any']+=len(re.findall(r'(:\s*any\b|\bas any\b|<any>)',txt))
                c['s_asunk']+=len(re.findall(r'as unknown as',txt))
                c['s_disable']+=len(re.findall(r'eslint-disable|oxlint-disable',txt))
                c['s_tsign']+=len(re.findall(r'@ts-(ignore|expect-error|nocheck)',txt))
                c['s_todo']+=len(re.findall(r'\b(TODO|FIXME|HACK)\b',txt))
                c['s_nonnull']+=len(re.findall(r'[\w\)\]]!\.',txt))
                c['s_cmt']+=len(re.findall(r'^\s*(//|/\*|\*)',txt,re.M))
                c['s_catch']+=len(re.findall(r'catch\s*(\([^)]*\))?\s*\{\s*\}',txt))
for ph in sorted(res):
    c=res[ph]
    print(ph,dict(c))
    print('   avg src loc/file %.0f | test:src LOC %.2f | expects/case %.2f | err-ish cases %.0f%% | a11y/role queries/case %.2f | mocks/case %.2f | comments/100 src loc %.1f'%(
      c['s_loc']/max(c['s_files'],1), c['t_loc']/max(c['s_loc'],1), c['t_expect']/max(c['t_cases'],1), 100*c['t_err']/max(c['t_cases'],1), c['t_role']/max(c['t_cases'],1), c['t_mock']/max(c['t_cases'],1), 100*c['s_cmt']/max(c['s_loc'],1)))
json.dump({k:dict(v) for k,v in res.items()},open('static.json','w'))
# eslint per phase: запустите `npx eslint . -f json -o ug-eslint.json` в репо и сопоставьте файлы с фазами по filesets при необходимости
