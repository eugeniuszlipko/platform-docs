# usage: repo label from to  (inclusive range from^..to) 
repo=$1; label=$2; from=$3; to=$4
cd /Users/mdr/Documents/Projects/workspace-one/$repo
rng="$from^..$to"
# numstat split: tests vs src
git diff --numstat $from^ $to > /tmp/ns.$$ 2>/dev/null
python3 - "$label" /tmp/ns.$$ <<'PY'
import sys,re
label,f=sys.argv[1:3]
t=s=d=m=0;tf=sf=0
for l in open(f):
    a,b,p=l.rstrip('\n').split('\t',2)
    if a=='-':continue
    a=int(a);b=int(b)
    if re.search(r'(\.test\.|\.spec\.|/tests?/|/e2e/|__tests__|vitest\.|playwright\.)',p): t+=a;tf+=1
    elif p.endswith('.sql'): m+=a
    elif p.endswith(('.md','.json','.png','.jpg','.svg','.lock')) : d+=a
    else: s+=a;sf+=1
print(f"{label}: src+{s} ({sf} files) tests+{t} ({tf} files) sql+{m} other+{d}")
PY
rm -f /tmp/ns.$$
# count test cases added
git diff $from^ $to -- '*.test.ts' '*.test.tsx' '*.spec.ts' '*.spec.tsx' | grep -E '^\+\s*(it|test)(\.each)?\(' | wc -l | xargs echo "   test cases added:"
git log --format=%s $rng | grep -ciE '^(fix|review)|review fix|reviewer fix' | xargs echo "   fix commits:"
git log --format=%h $rng | wc -l | xargs echo "   commits:"
