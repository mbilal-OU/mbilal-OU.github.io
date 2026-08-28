const D8_EXAM_KEY='sail-hpc-depth8-exam';
const D8_LAB_KEY='sail-hpc-depth8-labs';

const RESOURCES={
'What is an HPC cluster?':[
['sinfo','Show partitions and node availability.','modeled'],['sinfo -o "%P %a %l %D %C"','Format a compact partition summary.','reference'],['scontrol show partition','Inspect detailed partition configuration.','reference'],['scontrol show node <node>','Inspect node state and resources.','reference'],['hostname','Confirm which host you are using.','reference'],['pwd && ls','Orient yourself in the filesystem.','reference']],
'Login node vs compute node':[
['squeue -u $USER','Check your own queued and running jobs.','reference'],['salloc','Request an interactive allocation.','reference'],['srun --pty bash','Open an interactive shell inside an allocation.','reference'],['srun <program>','Launch a task under Slurm control.','reference'],['top / htop','Inspect local processes when permitted.','reference'],['exit','Leave an interactive shell cleanly.','reference']],
'What Slurm does':[
['sbatch job.sh','Submit a saved batch script.','reference'],['sbatch current','Submit the current SAIL-HPC JobSpec.','modeled'],['srun <program>','Launch a program or job step.','reference'],['salloc','Request an interactive allocation.','reference'],['squeue','Inspect queued and running work.','modeled'],['sacct','Inspect completed job accounting.','modeled']],
'Partitions and resources':[
['sinfo','Inspect partitions and availability.','modeled'],['squeue -u $USER','See your jobs and requested state.','reference'],['#SBATCH --partition=compute','Choose a site-defined partition.','reference'],['#SBATCH --cpus-per-task=8','Request cores for one threaded task.','reference'],['#SBATCH --mem=16G','Request total job memory.','reference'],['#SBATCH --time=02:00:00','Set the walltime limit.','reference'],['#SBATCH --gres=gpu:1','Request one GPU where this syntax is supported.','reference'],['sprio -j <jobid>','Inspect priority components.','reference']],
'Your first batch script':[
['#!/bin/bash','Choose the shell interpreter.','reference'],['#SBATCH --job-name=my_job','Give the job a useful name.','reference'],['#SBATCH --output=logs/%x-%j.out','Capture stdout safely.','reference'],['#SBATCH --error=logs/%x-%j.err','Capture stderr safely.','reference'],['mkdir -p logs','Create the log directory.','reference'],['sbatch job.sh','Submit the batch script.','reference']],
'Modules and Conda':[
['module avail','List software modules.','reference'],['module spider <software>','Search Lmod module trees.','reference'],['module load <software>','Load a site software environment.','reference'],['module list','Record loaded modules.','reference'],['module purge','Clear loaded modules.','reference'],['conda activate <env>','Activate a Conda environment.','reference'],['which <program>','Verify which executable will run.','reference'],['<program> --version','Record the software version.','reference']],
'Monitor a job':[
['squeue','Inspect active jobs.','modeled'],['squeue -u $USER','Filter to your own jobs.','reference'],['scontrol show job <jobid>','Inspect a job in detail.','modeled'],['sstat -j <jobid>.batch','Inspect live job-step resource statistics.','reference'],['tail -f logs/job.out','Follow application output.','reference'],['less logs/job.err','Inspect stderr safely.','reference']],
'Why jobs stay pending':[
['squeue','Read the pending reason.','modeled'],['scontrol show job <jobid>','Inspect scheduler details.','modeled'],['sprio -j <jobid>','Inspect priority factors.','reference'],['sshare','Inspect fair-share associations where permitted.','reference'],['scontrol hold <jobid>','Hold a modeled pending job.','modeled'],['scontrol release <jobid>','Release a modeled held job.','modeled']],
'Job arrays':[
['#SBATCH --array=1-12%3','Create 12 tasks with at most 3 concurrent.','reference'],['$SLURM_ARRAY_TASK_ID','Use the array index in your command.','reference'],['%A_%a','Use array IDs in log filenames.','reference'],['squeue','Observe array task states.','modeled'],['scancel <jobid>','Cancel modeled work.','modeled'],['sacct -j <array_jobid>','Inspect array accounting.','reference']],
'Dependencies':[
['--dependency=afterok:<jobid>','Run only after upstream success.','reference'],['--dependency=afterany:<jobid>','Run after upstream termination.','reference'],['--dependency=afternotok:<jobid>','Run after upstream failure.','reference'],['sbatch --dependency=afterok:$jid next.sh','Submit a downstream stage.','reference'],['scontrol show job <jobid>','Inspect dependency state.','modeled'],['squeue','Observe waiting downstream jobs.','modeled']],
'OOM and TIMEOUT':[
['sacct','Inspect terminal state and accounting.','modeled'],['seff <jobid>','Inspect modeled efficiency feedback.','modeled'],['scontrol show job <jobid>','Inspect the request and state.','modeled'],['grep -i -E "oom|out of memory|killed" logs/*.err','Search logs for memory evidence.','reference'],['tail -n 100 logs/job.err','Inspect recent stderr.','reference'],['sstat -j <jobid>.batch','Inspect live statistics where available.','reference']],
'Accounting and revision':[
['sacct','Inspect completed-job accounting.','modeled'],['seff <jobid>','Review CPU and memory efficiency.','modeled'],['sacct -j <jobid> --format=JobID,State,Elapsed,AllocCPUS,MaxRSS','Request useful accounting columns.','reference'],['sreport','Know that site accounting reports may be available.','reference'],['du -sh <path>','Check storage use.','reference'],['quota','Check filesystem quota where supported.','reference']],
'Moving to a real cluster':[
['sinfo','Recheck real partition names and limits.','modeled'],['sacctmgr show assoc user=$USER','Inspect account/QOS associations where permitted.','reference'],['module avail','Recheck real module names.','reference'],['pwd && df -h .','Verify filesystem location and capacity.','reference'],['which <program> && <program> --version','Verify executable provenance.','reference'],['sbatch --test-only job.sh','Validate a submission where supported.','reference'],['sbatch job.sh','Submit a small real test job.','reference']]
};

const LABS=[
{id:'basic',title:'Basic batch job',sub:'Build a FastQC job',starter:`#!/bin/bash\n#SBATCH --job-name=fastqc_one\n#SBATCH --partition=short\n#SBATCH --cpus-per-task=2\n#SBATCH --mem=4G\n#SBATCH --time=00:20:00\n#SBATCH --output=logs/%x-%j.out\n#SBATCH --error=logs/%x-%j.err\n\nmodule load FastQC\nmkdir -p logs\nfastqc reads/sample_A_R1.fastq.gz reads/sample_A_R2.fastq.gz`,checks:[[/^#!\/bin\/bash/m,'Shebang'],[/--partition(?:=|\s+)short/,'short partition'],[/--cpus-per-task(?:=|\s+)2\b/,'2 CPUs'],[/--mem(?:=|\s+)4G\b/i,'4 GB memory'],[/--time(?:=|\s+)00:20:00/,'20-minute walltime'],[/module\s+load\s+FastQC/i,'FastQC module'],[/fastqc\s+/i,'FastQC command']]},
{id:'threaded',title:'Threaded job',sub:'IQ-TREE with 8 CPUs',starter:`#!/bin/bash\n#SBATCH --job-name=phylogeny\n#SBATCH --partition=compute\n#SBATCH --cpus-per-task=8\n#SBATCH --mem=16G\n#SBATCH --time=02:00:00\n#SBATCH --output=logs/%x-%j.out\n#SBATCH --error=logs/%x-%j.err\n\nmodule load IQ-TREE\nmkdir -p logs\niqtree2 -s alignment.fasta -T "$SLURM_CPUS_PER_TASK"`,checks:[[/--partition(?:=|\s+)compute/,'compute partition'],[/--cpus-per-task(?:=|\s+)8\b/,'8 CPUs'],[/--mem(?:=|\s+)(16G|16384M)/i,'16 GB memory'],[/--time(?:=|\s+)02:00:00/,'2-hour walltime'],[/iqtree2?/i,'IQ-TREE command'],[/SLURM_CPUS_PER_TASK/,'threads tied to Slurm allocation']]},
{id:'array',title:'Job array',sub:'12 samples with %3',starter:`#!/bin/bash\n#SBATCH --job-name=qc_array\n#SBATCH --partition=short\n#SBATCH --array=1-12%3\n#SBATCH --cpus-per-task=2\n#SBATCH --mem=4G\n#SBATCH --time=00:30:00\n#SBATCH --output=logs/%A_%a.out\n\nmodule load FastQC\nfastqc "reads/sample_${SLURM_ARRAY_TASK_ID}.fastq.gz"`,checks:[[/--array(?:=|\s+)1-12%3/,'array 1-12%3'],[/SLURM_ARRAY_TASK_ID/,'task ID in command'],[/%A_%a/,'array-safe logs']]},
{id:'dependency',title:'Dependencies',sub:'afterok downstream',starter:`#!/bin/bash\n#SBATCH --job-name=summarize\n#SBATCH --partition=short\n#SBATCH --cpus-per-task=1\n#SBATCH --mem=4G\n#SBATCH --time=00:30:00\n#SBATCH --dependency=afterok:73001\n#SBATCH --output=logs/%x-%j.out\n\nmodule load R\nRscript summarize.R results/ summary.tsv`,checks:[[/--dependency(?:=|\s+)afterok:73001/,'afterok dependency'],[/Rscript\s+/,'Rscript command']]},
{id:'gpu',title:'GPU job',sub:'Request and run GPU',starter:`#!/bin/bash\n#SBATCH --job-name=gpu_train\n#SBATCH --partition=gpu\n#SBATCH --gres=gpu:1\n#SBATCH --cpus-per-task=4\n#SBATCH --mem=16G\n#SBATCH --time=01:00:00\n#SBATCH --output=logs/%x-%j.out\n\nmodule load CUDA\npython3 train.py --device cuda`,checks:[[/--partition(?:=|\s+)gpu/,'gpu partition'],[/--gres(?:=|\s+)gpu:1/,'1 GPU'],[/cuda|gpu/i,'GPU-aware command']]},
{id:'capstone',title:'Manual capstone',sub:'Write a complete script',starter:`#!/bin/bash\n\n# Scenario: compute partition; one threaded task; 8 CPUs; 16 GB; 2 hours.\n# Create separate stdout/stderr logs in logs/.\n# Load IQ-TREE and run alignment.fasta using the Slurm CPU allocation.\n`,checks:[[/^#!\/bin\/bash/m,'Shebang'],[/--job-name/,'Job name'],[/--partition(?:=|\s+)compute/,'compute partition'],[/--cpus-per-task(?:=|\s+)8\b/,'8 CPUs'],[/--mem(?:=|\s+)(16G|16384M)/i,'16 GB memory'],[/--time(?:=|\s+)02:00:00/,'2-hour walltime'],[/--output/,'stdout log'],[/--error/,'stderr log'],[/module\s+load\s+.*IQ[-_ ]?TREE/i,'IQ-TREE environment'],[/iqtree2?\s+.*alignment\.fasta/i,'IQ-TREE command'],[/SLURM_CPUS_PER_TASK/,'threads tied to allocation']]}
];

const COMMAND_Q=[
['Which command shows partitions and node availability?',['sinfo','sacct','scancel','module load'],'sinfo',2],
['Which command shows pending/running jobs?',['squeue','sreport','hostname','pwd'],'squeue',2],
['Which command submits a saved batch script?',['sbatch job.sh','sacct job.sh','sprio job.sh','sinfo job.sh'],'sbatch job.sh',2],
['Which command launches tasks/job steps?',['srun','sacct','sinfo','sshare'],'srun',2],
['Which command requests an interactive allocation?',['salloc','scancel','sreport','seff'],'salloc',2],
['Which command is used for completed-job accounting?',['sacct','squeue','module list','pwd'],'sacct',2],
['Which command can report live step resource use?',['sstat','sbatch','sinfo','salloc'],'sstat',2],
['Which command inspects priority components?',['sprio','seff','scancel','module purge'],'sprio',2],
['Which tool often summarizes efficiency?',['seff','srun','salloc','hostname'],'seff',2],
['Which command cancels a job?',['scancel','sacct','sstat','sreport'],'scancel',2]
];
const RESOURCE_Q=[
['A program uses 8 threads. Which request best matches?',['--ntasks=8','--cpus-per-task=8 with one task','--nodes=8','--array=1-8'],'--cpus-per-task=8 with one task',4],
['Which directive directly requests 16 GB total memory?',['--mem=16G','--mem-per-cpu=16G','--cpus-per-task=16','--time=16:00:00'],'--mem=16G',4],
['Which directive sets a two-hour limit?',['--time=02:00:00','--mem=2G','--nodes=2','--array=2'],'--time=02:00:00',4],
['Which array makes 12 tasks with max 3 concurrent?',['--array=1-12%3','--array=3-12','--cpus-per-task=12','--ntasks=3'],'--array=1-12%3',4],
['Stage B should run only after Stage A succeeds. Which dependency?',['afterok','afterany','afternotok','singleton memory'],'afterok',4]
];
const DIAG_Q=[
['A job ends OUT_OF_MEMORY. What should you inspect first?',['Memory request and application memory behavior','Add GPUs','Increase array size','Change job name'],'Memory request and application memory behavior',5],
['A job reaches TIMEOUT while memory is fine. Best next step?',['Review runtime, walltime and application performance','Double memory automatically','Request a GPU','Resubmit unchanged'],'Review runtime, walltime and application performance',5],
['A downstream job is PENDING with Reason=Dependency. First check?',['Upstream state and dependency expression','Node hostname','Permissions only','GPU model'],'Upstream state and dependency expression',5],
['You requested 8 CPUs but the application uses one. Key issue?',['Slurm allocation does not automatically make the application multithreaded','Memory is always too low','GPU partition required','Arrays required'],'Slurm allocation does not automatically make the application multithreaded',5]
];
const TRANSFER_Q=[
['Before transfer to a real site, what must be rechecked?',['Partition names and limits','Theme color','Certificate ID','Viewport'],'Partition names and limits',2],
['Which site-specific association may be required?',['Account/QOS','HTML theme','Tutorial number','SVG size'],'Account/QOS',2],
['Before module load Tool, what must you verify?',['Actual site module name/version','SVG support','GitHub avatar','Queue color'],'Actual site module name/version',2],
['What should be checked for I/O paths?',['Filesystem, permissions, quota and scratch/project policy','Only extension','Only job name','Nothing'],'Filesystem, permissions, quota and scratch/project policy',2],
['Safest first real transfer?',['Small test job after reading local documentation','Largest production run immediately','Heavy work on login node','Ignore local policy'],'Small test job after reading local documentation',2]
];

boot();
function boot(){
  const learn=document.querySelector('[data-view="learn"]');
  if(!learn)return;
  buildPathways(learn);buildRightRail();buildSidebarLabs();buildBottomLabs(learn);buildDialog();enhanceLesson();enhanceAssessment();upgradeNav();
}

function upgradeNav(){
  const nav=document.querySelector('.topnav'); if(!nav)return;
  const wanted=[['Test Myself','assessment'],['Pipeline','pipeline'],['Builder','builder']];
  for(const [label,route] of wanted){if(nav.querySelector(`[data-route="${route}"]`))continue;const b=mk('button',{type:'button',className:'nav-button','data-route':route},label);b.onclick=()=>location.hash=`#/${route}`;nav.append(b)}
}

function buildPathways(learn){
  if(document.getElementById('depth8-pathways'))return;
  const wrap=mk('div',{className:'depth8-pathways',id:'depth8-pathways'});
  const items=[['>_','I have my own pipeline','Bring scripts/commands and see how they behave on Slurm.','Go to Pipeline →','pipeline'],['▣','I want to learn','Follow a structured path from basics to advanced Slurm.','Start Learning →','learn'],['>_','I want to practice','Use the terminal and scientific scenarios to build skills.','Start Practice →','practice'],['♛','I want to test myself','Prove readiness with the 100-point examination.','Start Assessment →','assessment']];
  for(const [icon,title,copy,cta,route] of items){const c=mk('article',{className:'depth8-path-card'});const i=mk('div',{className:'d8-icon'},icon);const body=mk('div');body.append(mk('strong',{},title),mk('p',{},copy));const b=mk('button',{type:'button'},cta);b.onclick=()=>location.hash=`#/${route}`;body.append(b);c.append(i,body);wrap.append(c)}
  learn.insertBefore(wrap,learn.firstChild);
}

function buildRightRail(){
  const layout=document.querySelector('[data-view="learn"] .tutorial-layout'); if(!layout||document.getElementById('depth8-right-rail'))return;
  const rail=mk('aside',{className:'depth8-right-rail',id:'depth8-right-rail'});
  const obj=mk('section');obj.append(mk('h3',{},'Learning objectives'));const ul=mk('ul');['Define the current concept','Recognize the relevant Slurm commands','Apply the concept in a task','Identify what must be rechecked on a real cluster'].forEach(x=>ul.append(mk('li',{className:'check'},x)));obj.append(ul);
  const cheat=mk('section',{className:'depth8-cheat'});cheat.append(mk('h3',{},'Quick cheat sheet'));const code=mk('code');[['sinfo','# partitions'],['squeue -u $USER','# your jobs'],['sbatch job.sh','# submit'],['sacct -u $USER','# accounting'],['seff <jobid>','# efficiency'],['scontrol show job','# details']].forEach(([a,b])=>{code.append(mk('span',{},a),mk('span',{},b))});cheat.append(code);
  const concepts=mk('section',{className:'depth8-concepts'});concepts.append(mk('h3',{},'Key concepts'));const dl=mk('dl');[['Partition','Group of nodes'],['Node','A compute machine'],['CPU','Cores for your job'],['Memory','RAM per job/node'],['GPU','Accelerator']].forEach(([a,b])=>{dl.append(mk('dt',{},a),mk('dd',{},`→ ${b}`))});concepts.append(dl);
  const tip=mk('section',{className:'depth8-protip'});tip.append(mk('h3',{},'💡 Pro tip'),mk('p',{},'Start with a small test request, inspect the evidence, then scale. More resources are not automatically better.'));
  const exam=mk('section',{className:'depth8-exam-card'});exam.append(mk('h3',{},'SAIL-HPC Practical Readiness Examination'));const lines=mk('div',{className:'exam-lines'});[['Command selection','20 pts'],['Resource & #SBATCH design','20 pts'],['Failure & diagnosis','20 pts'],['Manual Slurm script','30 pts'],['Real-cluster transfer','10 pts']].forEach(([a,b])=>{const row=mk('div');row.append(mk('span',{},a),mk('span',{},b));lines.append(row)});exam.append(lines,mk('strong',{},'100 / 100 required for certificate'));const b=mk('button',{type:'button'},'Open Examination →');b.onclick=()=>location.hash='#/assessment';exam.append(b);
  rail.append(obj,cheat,concepts,tip,exam);layout.append(rail);
}

function buildSidebarLabs(){
  const side=document.querySelector('[data-view="learn"] .tutorial-sidebar');if(!side||document.getElementById('depth8-sidebar-labs'))return;
  const wrap=mk('div',{className:'depth8-sidebar-labs',id:'depth8-sidebar-labs'});wrap.append(mk('span',{},'Hands-on labs'));
  [['Slurm Building Lab','Build scripts step-by-step','New'],['Command Explorer','Explore commands safely',''],['Directive Explorer','Learn #SBATCH options','']].forEach(([a,b,badge],idx)=>{const btn=mk('button',{type:'button',className:'depth8-side-lab'});const body=mk('div');body.append(mk('b',{},a),mk('small',{},b));btn.append(mk('span',{},idx===0?'▤':idx===1?'⌘':'#'),body);if(badge)btn.append(mk('span',{className:'badge'},badge));btn.onclick=()=>idx===0?openLab('basic'):location.hash='#/practice';wrap.append(btn)});side.append(wrap)
}

function buildBottomLabs(learn){
  if(document.getElementById('depth8-building-panel'))return;
  const panel=mk('section',{className:'depth8-building-panel',id:'depth8-building-panel'});panel.append(mk('h2',{},'Slurm Building Lab – Learn by Building'));const grid=mk('div',{className:'depth8-lab-grid'});LABS.forEach((lab,i)=>{const c=mk('button',{type:'button',className:`depth8-lab-card${lab.id==='capstone'?' capstone':''}`});c.append(mk('span',{},lab.id==='capstone'?'♛':String(i+1)),mk('strong',{},lab.title),mk('small',{},lab.sub));c.onclick=()=>openLab(lab.id);grid.append(c)});panel.append(grid);const foot=mk('div',{className:'depth8-building-footer'});foot.append(mk('p',{},'Write scripts manually, validate them, then load them into the Builder to simulate and diagnose.'));const b=mk('button',{type:'button'},'Open Slurm Building Lab →');b.onclick=()=>openLab('basic');foot.append(b);panel.append(foot);learn.append(panel)
}

function enhanceLesson(){
  const title=document.getElementById('lesson-title');const copy=document.getElementById('lesson-copy');if(!title||!copy)return;
  const render=()=>{let panel=document.getElementById('depth8-resource-panel');if(!panel){panel=mk('section',{className:'depth8-resource-panel',id:'depth8-resource-panel'});copy.insertAdjacentElement('afterend',panel)}panel.replaceChildren();const resources=RESOURCES[title.textContent.trim()]||[];const tabs=mk('div',{className:'depth8-tabs'});['Concept','Commands & Literacy','Directives','Hands-On','Transfer Tips'].forEach((t,i)=>tabs.append(mk('span',{className:i===1?'active':''},t)));panel.append(tabs);const head=mk('div',{className:'depth8-panel-heading'});head.append(mk('h3',{},'Commands, directives and real-cluster literacy'),mk('small',{},`${resources.length} essential items`));panel.append(head);const grid=mk('div',{className:'depth8-resource-grid'});resources.forEach(([cmd,purpose,mode])=>{const card=mk('article',{className:`depth8-resource ${mode}`});card.append(mk('strong',{},cmd.split(' ')[0]),mk('p',{},purpose));const row=mk('div',{className:'depth8-cmdrow'});row.append(mk('code',{},cmd));const b=mk('button',{type:'button'},mode==='modeled'?'Insert →':'Copy →');b.onclick=()=>mode==='modeled'?openPractice(cmd):copy(cmd,b);row.append(b);card.append(row);grid.append(card)});panel.append(grid);panel.append(makeInlineTerminal(resources));};render();new MutationObserver(render).observe(title,{childList:true,subtree:true,characterData:true});
}

function makeInlineTerminal(resources){
  const wrap=mk('div',{className:'depth8-inline-terminal'});const term=mk('div',{className:'depth8-terminal'});const head=mk('div',{className:'depth8-terminal-head'});head.append(mk('span',{},'SAIL-HPC Terminal (Simulated Slurm Environment)'));const clear=mk('button',{type:'button'},'Clear');head.append(clear);const pre=mk('pre');const cmd=(resources.find(r=>r[2]==='modeled')||['sinfo'])[0];pre.innerHTML=`<span class="prompt">sail-hpc:~$</span> ${escapeHtml(cmd)}\nPARTITION   AVAIL   TIMELIMIT   NODES   STATE\nshort       up      02:00:00    10      idle\ncompute     up      7-00:00:00  20      idle\nhighmem     up      7-00:00:00   2      idle\ngpu         up      7-00:00:00   4      idle\n<span class="prompt">sail-hpc:~$</span> `;clear.onclick=()=>pre.textContent='sail-hpc:~$ ';term.append(head,pre);const note=mk('div',{className:'depth8-notice'});note.append(mk('h4',{},'What to notice'));const ul=mk('ul');['Different partitions serve different needs.','Time limits vary by partition.','A node can be busy or idle.','The resource request must match the application.'].forEach(x=>ul.append(mk('li',{},x)));note.append(ul);wrap.append(term,note);return wrap
}

function buildDialog(){
  if(document.getElementById('depth8-dialog'))return;const d=mk('dialog',{className:'depth8-dialog',id:'depth8-dialog'});const head=mk('div',{className:'depth8-dialog-head'});const h=mk('div');h.append(mk('span',{className:'eyebrow'},'Hands-on practical'),mk('h2',{},'Slurm Building Lab'));const close=mk('button',{type:'button'},'Close');close.onclick=()=>d.close();head.append(h,close);const body=mk('div',{className:'depth8-dialog-body'});const nav=mk('nav',{className:'depth8-lab-nav',id:'depth8-lab-nav'});const main=mk('main',{className:'depth8-lab-main',id:'depth8-lab-main'});body.append(nav,main);d.append(head,body);document.body.append(d)
}

function openLab(id){
  const d=document.getElementById('depth8-dialog');const nav=document.getElementById('depth8-lab-nav');const main=document.getElementById('depth8-lab-main');if(!d||!nav||!main)return;nav.replaceChildren();LABS.forEach(l=>{const b=mk('button',{type:'button',className:l.id===id?'active':''},`${l.title}\n${l.sub}`);b.onclick=()=>openLab(l.id);nav.append(b)});const lab=LABS.find(l=>l.id===id)||LABS[0];main.replaceChildren();main.append(mk('h3',{},lab.title),mk('p',{},lab.id==='capstone'?'Independent capstone: write the complete script yourself. The validator checks structural requirements but does not reveal the final script.':'Edit the script, validate it, and understand why every directive exists.'));const ta=mk('textarea',{spellcheck:'false'});const saved=read(D8_LAB_KEY,{});ta.value=saved[lab.id]?.draft||lab.starter;ta.oninput=()=>{const state=read(D8_LAB_KEY,{});state[lab.id]={...(state[lab.id]||{}),draft:ta.value};localStorage.setItem(D8_LAB_KEY,JSON.stringify(state))};main.append(ta);const actions=mk('div',{className:'depth8-lab-actions'});const check=mk('button',{type:'button',className:'primary'},'Check script');const reset=mk('button',{type:'button'},'Reset exercise');const load=mk('button',{type:'button'},'Load into main Builder');actions.append(check,reset,load);main.append(actions);const result=mk('div',{className:'depth8-lab-result'},'Not scored yet.');main.append(result);check.onclick=()=>{const res=lab.checks.map(([re,label])=>({label,pass:re.test(ta.value)}));const passed=res.filter(x=>x.pass).length;const score=Math.round(passed/res.length*100);result.className=`depth8-lab-result${score===100?' ok':''}`;result.textContent=`${score}/100 · ${passed}/${res.length} requirements satisfied${score===100?' · Ready to transfer into Builder.':''}`;const state=read(D8_LAB_KEY,{});state[lab.id]={...(state[lab.id]||{}),draft:ta.value,score};localStorage.setItem(D8_LAB_KEY,JSON.stringify(state))};reset.onclick=()=>{ta.value=lab.starter;ta.dispatchEvent(new Event('input'));result.className='depth8-lab-result';result.textContent='Exercise reset.'};load.onclick=()=>{d.close();location.hash='#/builder';setTimeout(()=>{const imp=document.getElementById('import-text');if(imp){imp.value=ta.value;document.getElementById('import-script')?.click()}},120)};if(!d.open)d.showModal()
}

function enhanceAssessment(){
  const host=document.querySelector('[data-view="assessment"] .workspace-main');if(!host||document.getElementById('depth8-exam'))return;const oldList=document.getElementById('assessment-task-list');if(oldList)oldList.hidden=true;const oldReview=document.getElementById('assessment-review');if(oldReview)oldReview.hidden=true;const title=host.querySelector('.page-head h1');const p=host.querySelector('.page-head p');if(title)title.textContent='SAIL-HPC Practical Readiness Examination';if(p)p.textContent='Independent 100-point capstone: commands, resource design, diagnosis, manual Slurm scripting and real-cluster transfer. 100/100 is required for the certificate.';const exam=mk('section',{className:'depth8-exam',id:'depth8-exam'});exam.append(mk('h2',{},'Practical Readiness Examination'),mk('p',{},'Retakes are allowed. Incorrect answers are not revealed automatically; return to Learn, Practice, or the Slurm Building Lab before trying again.'));
  const groups=[['A · Command selection',20,COMMAND_Q],['B · Resource and #SBATCH design',20,RESOURCE_Q],['C · Failure and diagnosis',20,DIAG_Q]];groups.forEach(([name,pts,qs])=>exam.append(questionGroup(name,pts,qs)));
  const script=mk('details',{className:'depth8-exam-section'});const sum=mk('summary',{},'D · Manual Slurm script capstone — 30 points');script.append(sum);const sb=mk('div',{className:'depth8-exam-body'});sb.append(mk('p',{},'Write a complete IQ-TREE job: compute partition, one threaded task, 8 CPUs, 16 GB, 2-hour walltime, separate stdout/stderr logs, IQ-TREE module, alignment.fasta, and application threads tied to the Slurm allocation.'));const ta=mk('textarea',{id:'depth8-exam-script',spellcheck:'false'});sb.append(ta);script.append(sb);exam.append(script);exam.append(questionGroup('E · Real-cluster transfer safety',10,TRANSFER_Q));const sc=mk('div',{className:'depth8-exam-score'});const score=mk('strong',{id:'depth8-score'},'0/100');const sub=mk('button',{type:'button'},'Submit Examination');sc.append(score,sub);exam.append(sc);const fb=mk('div',{className:'depth8-exam-feedback',id:'depth8-feedback'},'Certificate requires 100/100.');exam.append(fb);host.append(exam);sub.onclick=()=>gradeExam();restoreExam();enforceCertificate();
}

function questionGroup(title,pts,qs){const d=mk('details',{className:'depth8-exam-section'});d.append(mk('summary',{},`${title} — ${pts} points`));const body=mk('div',{className:'depth8-exam-body'});qs.forEach((q,i)=>{const fs=mk('fieldset',{className:'depth8-q'});fs.append(mk('legend',{},q[0]));q[1].forEach(opt=>{const lab=mk('label');const input=mk('input',{type:'radio',name:`d8-${slug(title)}-${i}`,value:opt});lab.append(input,document.createTextNode(opt));fs.append(lab)});body.append(fs)});d.append(body);return d}

function gradeExam(){
  let score=0;const groups=[[COMMAND_Q,'a'],[RESOURCE_Q,'b'],[DIAG_Q,'c'],[TRANSFER_Q,'e']];const sections=document.querySelectorAll('#depth8-exam .depth8-exam-section');let sec=0;for(const [qs] of groups){const section=sections[sec++];qs.forEach((q,i)=>{const checked=section?.querySelectorAll('fieldset')[i]?.querySelector('input:checked');if(checked?.value===q[2])score+=q[3]});if(sec===3)sec++}
  const script=document.getElementById('depth8-exam-script')?.value||'';const cap=LABS.find(l=>l.id==='capstone');const passed=cap.checks.filter(([re])=>re.test(script)).length;score+=Math.min(30,Math.round(passed/cap.checks.length*30));localStorage.setItem(D8_EXAM_KEY,JSON.stringify({score,script}));const s=document.getElementById('depth8-score');const f=document.getElementById('depth8-feedback');if(s)s.textContent=`${score}/100`;if(f){f.textContent=score===100?'100/100 achieved. Certificate eligibility unlocked.':`${score}/100. Return to Learn, Practice and Building Lab, then retake.`;f.className=`depth8-exam-feedback${score===100?' ok':''}`};const old=document.getElementById('assessment-score');if(old)old.textContent=String(score);enforceCertificate();
}
function restoreExam(){const st=read(D8_EXAM_KEY,{});const s=document.getElementById('depth8-score');if(s)s.textContent=`${Number(st.score||0)}/100`;const ta=document.getElementById('depth8-exam-script');if(ta)ta.value=st.script||''}
function enforceCertificate(){const score=Number(read(D8_EXAM_KEY,{}).score||0);const claim=document.getElementById('claim-certificate');if(claim){claim.disabled=score!==100;claim.textContent=score===100?'Claim completion certificate':'Certificate requires 100/100';claim.onclick=score===100?()=>location.hash='#/certificate':null}const gen=document.getElementById('generate-certificate');if(gen)gen.disabled=score!==100}

function openPractice(cmd){location.hash='#/practice';setTimeout(()=>{const input=document.getElementById('terminal-input');if(input){input.value=cmd;input.focus()}},100)}
function copy(value,b){navigator.clipboard?.writeText(value).then(()=>flash(b)).catch(()=>{const ta=document.createElement('textarea');ta.value=value;document.body.append(ta);ta.select();document.execCommand('copy');ta.remove();flash(b)})}
function flash(b){const old=b.textContent;b.textContent='Copied';setTimeout(()=>b.textContent=old,800)}
function read(k,f){try{return JSON.parse(localStorage.getItem(k)||'')||f}catch{return f}}
function slug(s){return s.toLowerCase().replace(/[^a-z0-9]+/g,'-')}
function escapeHtml(s){return String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}
function mk(tag,attrs={},text=null){const n=document.createElement(tag);Object.entries(attrs).forEach(([k,v])=>{if(k==='className')n.className=v;else if(k==='spellcheck')n.spellcheck=v==='true'||v===true;else if(k==='type')n.type=v;else if(k==='name')n.name=v;else if(k==='value')n.value=v;else n.setAttribute(k,String(v))});if(text!==null)n.textContent=text;return n}
