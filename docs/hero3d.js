/* CIRP hero companion (Three.js, procedural model). Loaded lazily by app.js only when the hero is enabled.
   Optional: place an authored cirp_superhero.glb beside index.html and it will be used automatically. */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.164.1/examples/jsm/loaders/GLTFLoader.js';
(()=>{
 const dock=document.getElementById('mascot3D-dock'),canvas=document.getElementById('mascot3D-canvas'),bubble=document.getElementById('mascot3D-bubble'),label=document.getElementById('mascot3D-label');if(!dock||!canvas)return;
 let renderer;try{renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});}catch(e){label.textContent='3D character needs WebGL';return;}
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setSize(canvas.clientWidth||220,canvas.clientHeight||280,false);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const scene=new THREE.Scene();scene.fog=new THREE.Fog(0x101827,9,18);const camera=new THREE.PerspectiveCamera(31,(canvas.clientWidth||220)/(canvas.clientHeight||280),.1,60);camera.position.set(0,1.9,8.6);camera.lookAt(0,1.7,0);
 scene.add(new THREE.HemisphereLight(0xeaf2ff,0x25101d,2.4));const key=new THREE.DirectionalLight(0xffe5b6,4.2);key.position.set(3.5,6,5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.bias=-0.00025;scene.add(key);const fill=new THREE.DirectionalLight(0x75aaff,2.65);fill.position.set(-4,2.5,4);scene.add(fill);const rim=new THREE.PointLight(0xffb83d,3.4,12);rim.position.set(0,3.2,-2);scene.add(rim);const faceFill=new THREE.PointLight(0xffdfc0,1.35,7);faceFill.position.set(0,2.9,4);scene.add(faceFill);const topSoft=new THREE.SpotLight(0x8ccfff,1.5,10,Math.PI/5,.6,1.4);topSoft.position.set(-1,5,2);topSoft.target.position.set(0,1.8,0);scene.add(topSoft,topSoft.target);
 const material=(c,m=0,r=.48)=>new THREE.MeshStandardMaterial({color:c,metalness:m,roughness:r});
 const suit=material(0x111b30,.35,.34),suit2=material(0x202e48,.3,.38),gold=material(0xe7b44e,.78,.24),goldLight=material(0xffd979,.65,.22),shirt=material(0xf5f1e7,0,.45),skin=material(0xd99a70,0,.53),skinShade=material(0xa96748,0,.6),hair=material(0x201513,.05,.72),hairLight=material(0x4a2b22,.08,.5),boot=material(0x080d18,.25,.3),tie=material(0x8e1f31,.28,.3),eyeWhite=material(0xfff9f0,0,.25),iris=material(0x5b9fbd,.15,.2),pupil=material(0x10182c,.05,.15),glasses=material(0x171b27,.5,.22),glass= new THREE.MeshPhysicalMaterial({color:0x8ccde8,transparent:true,opacity:.16,roughness:.08,metalness:.1,clearcoat:1}),capeMat=material(0x8d1c2b,.25,.35),capeInner=material(0x251a30,.25,.4),whiteGlow=new THREE.MeshBasicMaterial({color:0xffffff});
 const hero=new THREE.Group();scene.add(hero);const parts={};
 function add(parent,geo,mat,pos=[0,0,0],scale=null){const o=new THREE.Mesh(geo,mat);o.position.set(...pos);if(scale)o.scale.set(...scale);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
 function ball(parent,mat,pos,scale){return add(parent,new THREE.SphereGeometry(1,32,24),mat,pos,scale)}
 function cylinderBetween(parent,a,b,rA,rB,mat,segments=16){const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),d=B.clone().sub(A);const o=add(parent,new THREE.CylinderGeometry(rB,rA,d.length(),segments),mat,A.clone().add(B).multiplyScalar(.5).toArray());o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return o;}
 function roundedBox(parent,pos,size,mat,rad=.06){const geo=new THREE.BoxGeometry(...size);const o=add(parent,geo,mat,pos);return o;}
 // Core body, tailored suit silhouette, shirt, collar and tie
 const torso=new THREE.Group();torso.position.y=1.72;hero.add(torso);parts.torso=torso;
 ball(torso,suit,[0,.02,0],[.53,.69,.31]);ball(torso,shirt,[0,.08,.286],[.235,.48,.055]);
 // Jacket panels and lapels
 const lapL=add(torso,new THREE.ConeGeometry(.22,.7,4),suit2,[-.19,.18,.31],[.75,1,.25]);lapL.rotation.z=-.22;lapL.rotation.y=-.12;
 const lapR=add(torso,new THREE.ConeGeometry(.22,.7,4),suit2,[.19,.18,.31],[.75,1,.25]);lapR.rotation.z=.22;lapR.rotation.y=.12;
 ball(torso,suit2,[-.42,-.12,.12],[.16,.42,.24]);ball(torso,suit2,[.42,-.12,.12],[.16,.42,.24]);
 // Tailored seam piping, shoulder epaulettes and jacket buttons for a more finished anime-hero silhouette
 for(const side of [-1,1]){const ep=ball(torso,gold,[side*.42,.48,.06],[.19,.095,.20]);ep.rotation.z=side*-.18;const seamPts=[new THREE.Vector3(side*.39,.25,.285),new THREE.Vector3(side*.43,-.02,.30),new THREE.Vector3(side*.39,-.30,.285)];add(torso,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(seamPts),18,.009,6,false),goldLight); }
 // shirt collar triangles
 const collarL=add(torso,new THREE.ConeGeometry(.13,.25,4),shirt,[-.11,.45,.33],[.65,1,.22]);collarL.rotation.z=-.35;const collarR=add(torso,new THREE.ConeGeometry(.13,.25,4),shirt,[.11,.45,.33],[.65,1,.22]);collarR.rotation.z=.35;
 const tieKnot=add(torso,new THREE.SphereGeometry(.075,16,12),tie,[0,.39,.37],[.8,1,.55]);const tieBody=add(torso,new THREE.BufferGeometry(),tie,[0,.12,.365]);
 const tieShape=new THREE.Shape();tieShape.moveTo(-.055,.28);tieShape.lineTo(.055,.28);tieShape.lineTo(.11,-.12);tieShape.lineTo(0,-.22);tieShape.lineTo(-.11,-.12);tieShape.closePath();const tieMesh=add(torso,new THREE.ShapeGeometry(tieShape),tie,[0,.18,.38]);
 // Chest crest: gold shield, scales-inspired lines and buttons
 const crest=add(torso,new THREE.CircleGeometry(.12,32),gold,[.28,.28,.342]);const crestInner=add(torso,new THREE.CircleGeometry(.095,32),suit,[.28,.28,.35]);
 cylinderBetween(torso,[.23,.28,.36],[.33,.28,.36],.009,.009,goldLight,8);cylinderBetween(torso,[.28,.22,.36],[.28,.34,.36],.009,.009,goldLight,8);ball(torso,gold,[0,-.15,.32],[.025,.025,.012]);ball(torso,gold,[0,-.27,.31],[.025,.025,.012]);
 // Belt and buckle
 const belt=add(torso,new THREE.CylinderGeometry(.43,.43,.12,32),boot,[0,-.48,0]);belt.scale.z=.75;roundedBox(torso,[0,-.48,.3],[.13,.12,.04],gold,.02);
 // Tailored jacket darts, pocket welt, cuff buttons and subtle fabric seams.
 for(const side of [-1,1]){
  const pocket=add(torso,new THREE.BoxGeometry(.13,.012,.018),gold,[side*.29,-.08,.332]);
  const cuff=add(torso,new THREE.TorusGeometry(.092,.012,8,20),gold,[side*.43,-.22,.055]);cuff.rotation.y=Math.PI/2;
  for(let j=0;j<2;j++)ball(torso,goldLight,[side*.44,-.19-j*.045,.13],[.012,.012,.012]);
 }
 // Neck and head rig
 const neck=ball(hero,skin,[0,2.43,.01],[.16,.22,.15]);const head=new THREE.Group();head.position.set(0,2.78,.04);hero.add(head);parts.head=head;
 ball(head,skin,[0,0,0],[.43,.5,.36]);ball(head,skinShade,[0,-.24,.12],[.27,.14,.23]);
 // Ears and detailed anime eyes with layered irises, highlights and eyelids
 const eyeRigs=[],browRigs=[];for(const s of [-1,1]){
  ball(head,skin,[s*.414,-.015,0],[.085,.13,.09]);ball(head,skinShade,[s*.43,-.02,.045],[.032,.07,.03]);
  const ex=s*.165;const eye=ball(head,eyeWhite,[ex,.045,.305],[.125,.16,.055]);eyeRigs.push(eye);ball(head,iris,[ex+s*.008,.035,.353],[.073,.105,.028]);ball(head,pupil,[ex+s*.008,.032,.375],[.039,.072,.018]);ball(head,whiteGlow,[ex-.02,.075,.393],[.026,.033,.012]);ball(head,whiteGlow,[ex+.026,.005,.392],[.012,.015,.008]);
  const brow=ball(head,hair,[ex,.19,.30],[.13,.035,.045]);brow.rotation.z=s*-.08;browRigs.push({mesh:brow,base:brow.rotation.z,side:s});
  const lid=add(head,new THREE.TorusGeometry(.126,.018,8,24,Math.PI),hair,[ex,.045,.335]);lid.rotation.z=Math.PI;
 }
 // Subtle anime blush and sculpted nose bridge
 for(const side of [-1,1]){const blush=material(0xd96f70,0,.85);const cheek=ball(head,blush,[side*.235,-.095,.325],[.072,.028,.018]);cheek.material.transparent=true;cheek.material.opacity=.42;}
 // Nose and expressive smile
 ball(head,skin,[0,-.07,.36],[.045,.07,.055]);const smilePts=[];for(let i=0;i<=18;i++){const x=-.13+i*(.26/18);smilePts.push(new THREE.Vector3(x,-.19+.045*Math.pow(x/.13,2),.341));}const smile=add(head,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(smilePts),24,.012,8,false),tie);
 // Sculpted anime hair cap + swept forelock and separated spikes
 ball(head,hair,[0,.29,-.035],[.46,.29,.39]);
 const tuftDefs=[[-.34,.29,.19,.28,-.52],[-.24,.42,.2,.34,-.38],[-.1,.48,.18,.31,-.12],[.06,.47,.18,.32,.08],[.22,.39,.18,.31,.38],[.34,.29,.16,.27,.55],[-.28,.16,.16,.29,-.65],[.2,.2,.16,.27,.62]];
 tuftDefs.forEach((d,i)=>{const tuft=add(head,new THREE.ConeGeometry(d[3]*.42,d[3],10),i%3===0?hairLight:hair,[d[0],d[1],d[2]],[1,.95,.72]);tuft.rotation.z=d[4];tuft.rotation.x=-.18;});
 // Layered side locks
 for(const s of [-1,1]){const lock=add(head,new THREE.ConeGeometry(.13,.47,9),hair,[s*.36,-.03,.12],[.85,1,.75]);lock.rotation.z=s*.24;const streak=add(head,new THREE.ConeGeometry(.025,.24,6),hairLight,[s*.34,.06,.19]);streak.rotation.z=s*.22;}
 // Fine sculptural hair grooves and highlight strands, kept as mesh geometry (not a sprite).
 for(let i=0;i<7;i++){const x=-.28+i*.093;const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(x,.36,.245),new THREE.Vector3(x+.025,.47,.235),new THREE.Vector3(x+.06,.51-(i%3)*.025,.19)]);add(head,new THREE.TubeGeometry(curve,12,.008,6,false),hairLight);}
 // Anime-style lower eyelid accents and cheek highlights.
 for(const side of [-1,1]){const pts=[];for(let i=0;i<=10;i++){const u=i/10;pts.push(new THREE.Vector3(side*(.165-.105+u*.21),-.055-.055*Math.sin(u*Math.PI),.342));}add(head,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),12,.008,6,false),skinShade);ball(head,whiteGlow,[side*.24,-.09,.348],[.012,.008,.006]);}
 // Glasses frames, bridge and temples
 for(const s of [-1,1]){const rimFrame=add(head,new THREE.TorusGeometry(.145,.018,10,32),glasses,[s*.165,.045,.365]);rimFrame.scale.y=1.03;const lensDisc=add(head,new THREE.CircleGeometry(.127,32),glass,[s*.165,.045,.36]);const temple=cylinderBetween(head,[s*.30,.06,.34],[s*.43,.07,.08],.014,.012,glasses,8);}
 cylinderBetween(head,[-.025,.05,.37],[.025,.05,.37],.016,.016,gold,10);
 // Articulated cape mesh with segmented trailing cloth, pinned at shoulders
 const capeRig=new THREE.Group();capeRig.position.set(0,2.24,-.18);hero.add(capeRig);parts.capeRig=capeRig;
 const capeShape=new THREE.Shape();capeShape.moveTo(-.22,.22);capeShape.quadraticCurveTo(-.48,-.2,-.62,-1.65);capeShape.quadraticCurveTo(0,-1.42,.62,-1.65);capeShape.quadraticCurveTo(.48,-.2,.22,.22);capeShape.closePath();const capeGeo=new THREE.ShapeGeometry(capeShape,18);const cape=add(capeRig,capeGeo,capeMat,[0,0,-.02]);cape.material.side=THREE.DoubleSide;cape.rotation.x=.08;const capeLining=add(capeRig,capeGeo,capeInner,[0,0,-.035]);capeLining.material.side=THREE.DoubleSide;capeLining.scale.set(.88,.94,1);
 // Raised cape clasp and subtle embossed crest at the shoulder line
 const clasp=ball(capeRig,goldLight,[0,.16,.055],[.105,.105,.045]);const claspCore=ball(capeRig,boot,[0,.16,.09],[.067,.067,.018]);cylinderBetween(capeRig,[-.035,.16,.112],[.035,.16,.112],.006,.006,goldLight,8);cylinderBetween(capeRig,[0,.125,.112],[0,.195,.112],.006,.006,goldLight,8);
 // Gold piping on cape edge
 const edgePts=[new THREE.Vector3(-.22,.2,.015),new THREE.Vector3(-.44,-.32,.015),new THREE.Vector3(-.58,-1.55,.015)];add(capeRig,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edgePts),18,.012,6,false),goldLight);const edgePts2=edgePts.map(v=>new THREE.Vector3(-v.x,v.y,v.z));add(capeRig,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edgePts2),18,.012,6,false),goldLight);
 // Shoulder joints, upper arms, elbow pivots, forearms and palms/fingers. Rotations are true articulated joints.
 function makeArm(side){const shoulder=new THREE.Group();shoulder.position.set(side*.43,2.18,.015);hero.add(shoulder);ball(shoulder,gold,[0,0,0],[.18,.18,.17]);cylinderBetween(shoulder,[0,0,0],[side*.04,-.34,.015],.135,.105,suit,18);ball(shoulder,suit2,[side*.04,-.34,.015],[.11,.12,.11]);const elbow=new THREE.Group();elbow.position.set(side*.04,-.34,.015);shoulder.add(elbow);cylinderBetween(elbow,[0,0,0],[side*.02,-.29,.05],.105,.078,shirt,16);ball(elbow,skin,[side*.02,-.29,.05],[.082,.09,.085]);const hand=new THREE.Group();hand.position.set(side*.02,-.31,.075);elbow.add(hand);ball(hand,skin,[0,-.005,.015],[.105,.115,.075]);for(let i=0;i<4;i++){const x=(i-1.5)*.043;const f=cylinderBetween(hand,[x,-.04,.04],[x+side*.008,-.12+(Math.abs(i-1.5)*.012),.045],.022,.014,skin,10);ball(hand,skin,[x+side*.008,-.12+(Math.abs(i-1.5)*.012),.045],[.016,.02,.016]);}const thumb=cylinderBetween(hand,[side*.08,-.005,.04],[side*.12,-.055,.055],.027,.019,skin,10);return {shoulder,elbow,hand};}
 parts.armL=makeArm(-1);parts.armR=makeArm(1);
 // Separate hip, thigh, knee, shin and boots with gold trim
 function makeLeg(side){const hip=new THREE.Group();hip.position.set(side*.22,1.22,0);hero.add(hip);ball(hip,suit2,[0,0,0],[.17,.18,.18]);cylinderBetween(hip,[0,0,0],[side*.025,-.38,.01],.15,.115,suit,18);const knee=new THREE.Group();knee.position.set(side*.025,-.38,.01);hip.add(knee);ball(knee,suit2,[0,0,0],[.115,.12,.12]);cylinderBetween(knee,[0,0,0],[side*.02,-.36,.035],.105,.085,suit,16);const shoe= new THREE.Group();shoe.position.set(side*.02,-.37,.06);knee.add(shoe);ball(shoe,boot,[0,-.015,.06],[.14,.09,.24]);ball(shoe,gold,[0,.035,.13],[.095,.014,.015]);return {hip,knee,shoe};}
 parts.legL=makeLeg(-1);parts.legR=makeLeg(1);
 // Tablet with beveled body and screen in the left hand area
 const tabletRig=new THREE.Group();tabletRig.position.set(-.48,1.76,.35);hero.add(tabletRig);const tablet=add(tabletRig,new THREE.BoxGeometry(.34,.47,.055),boot,[0,0,0]);const screen=add(tabletRig,new THREE.BoxGeometry(.29,.4,.012),material(0x1e3857,.25,.22),[0,0,.035]);const logo=add(tabletRig,new THREE.CircleGeometry(.045,24),gold,[0,.08,.045]);
 // Ground glow and tiny gold orbit particles (kept within character stage)
 const halo=add(hero,new THREE.TorusGeometry(.7,.014,8,56),gold,[0,.08,0]);halo.rotation.x=Math.PI/2;const particles=[];for(let i=0;i<12;i++){const p=add(hero,new THREE.SphereGeometry(.018,8,8),i%2?gold:goldLight,[Math.cos(i*.52)*(.75+(i%3)*.08),.35+(i%5)*.47,-.12]);particles.push({mesh:p,phase:i*.9});}
 let mood='greeting',lastEdge=0,edge=0,manualPointUntil=0;const clock=new THREE.Clock();
 const moodText={greeting:['🙏 Namaste','Namaste! I’m here to help you stay ahead of your CIRP milestones.'],thinking:['🔎 Reviewing next step','Let’s review the next milestone and its dependency before updating the date.'],worried:['⚠ Deadline needs attention','This task is overdue. I’ll point out the affected step—please verify its legal deadline.'],happy:['🏆 Great work','Excellent! The task is recorded as completed. Let’s check what comes next.'],idle:['✦ Watching deadlines','I’m keeping an eye on the next upcoming milestone.']};
 function setMood(next,force=false){if(!next)next='idle';if(next===mood&&!force)return;mood=next;const t=moodText[mood]||moodText.idle;label.textContent=t[0];bubble.textContent=t[1];bubble.classList.add('show');playAuthoredClip(mood);clearTimeout(setMood.timer);setMood.timer=setTimeout(()=>bubble.classList.remove('show'),5200);}
 // The 3D companion is the only mascot. Task updates drive its pose and speech directly.
 window.addEventListener('cirp:mascot-mood',e=>{const d=e.detail||{};if(d.message)bubble.textContent=d.message;setMood(d.mood||'idle',true);});
 // Keep the 3D companion docked in one predictable corner; it points with its arm instead of roaming over content.
 function borderPosition(t){dock.style.left='auto';dock.style.top='auto';dock.style.right=innerWidth<700?'6px':'18px';dock.style.bottom=innerWidth<700?'6px':'18px';}
 function pointPose(){const open=[...document.querySelectorAll('#tbody tr')].find(r=>r.querySelector('.pill.p-red'));if(open){const rect=open.getBoundingClientRect();if(rect.top>0&&rect.top<innerHeight){manualPointUntil=performance.now()+6500;parts.armR.shoulder.rotation.z=-1.1;}}}
 window.addEventListener('cirp:focus-due',pointPose);
 // Prefer the authored Blender GLB asset when it is deployed beside index.html; otherwise retain the built-in 3D fallback.
 let authoredHero=null,authoredMixer=null,authoredActions={},authoredActive=null;
 function playAuthoredClip(m){if(!authoredMixer)return;const names={greeting:['Namaste_Greeting','Idle_Breathing'],thinking:['Point_To_Task','Idle_Breathing'],worried:['Point_To_Task','Idle_Breathing'],happy:['Celebrate','Idle_Breathing'],idle:['Idle_Breathing']};const choices=names[m]||names.idle;let clip=null;for(const n of choices){clip=THREE.AnimationClip.findByName(authoredHero.animations,n)||authoredHero.animations.find(a=>a.name.toLowerCase().includes(n.toLowerCase()));if(clip)break;}if(!clip)return;const action=authoredMixer.clipAction(clip);if(authoredActive&&authoredActive!==action){authoredActive.fadeOut(.18);}action.reset().fadeIn(.18).play();authoredActive=action;}
 fetch('./cirp_superhero.glb',{method:'HEAD'}).then(r=>{if(!r.ok)return;try{const gltfLoader=new GLTFLoader();gltfLoader.load('./cirp_superhero.glb',gltf=>{authoredHero=gltf;authoredHero.scene.name='CIRP Anime Hero | Blender GLB';authoredHero.scene.scale.setScalar(.96);authoredHero.scene.position.set(0,-.03,0);scene.add(authoredHero.scene);hero.visible=false;authoredMixer=new THREE.AnimationMixer(authoredHero.scene);authoredHero.animations=gltf.animations||[];playAuthoredClip(mood);label.textContent='CIRP Hero · 3D Rig';},undefined,()=>{/* GLB is optional until the Blender asset is built; procedural articulated 3D remains active. */});}catch(e){/* keep procedural character */}}).catch(()=>{});
 function animate(){requestAnimationFrame(animate);if(document.hidden||dock.style.display==='none'){clock.getDelta();return}const delta=clock.getDelta(),t=clock.elapsedTime;if(authoredMixer)authoredMixer.update(Math.min(delta,.05));
  // Idle breathing and head tracking; independent joint animation, not image swapping.
  torso.scale.y=1+.014*Math.sin(t*2.15);torso.rotation.z=.012*Math.sin(t*1.15);head.rotation.y=.075*Math.sin(t*.62);head.rotation.x=.018*Math.sin(t*1.35);head.rotation.z=.022*Math.sin(t*1.55);capeRig.rotation.x=.065*Math.sin(t*1.85)+.018*Math.sin(t*3.1);capeRig.rotation.y=.085*Math.sin(t*1.35);cape.rotation.z=.028*Math.sin(t*2.2);
  const pointing=performance.now()<manualPointUntil;const blink=Math.pow(Math.max(0,Math.cos(t*1.7)),42);eyeRigs.forEach(e=>{e.scale.y=.16*(1-.93*blink);});browRigs.forEach(b=>{let target=b.base;if(mood==='worried')target+=b.side*.13;if(mood==='happy')target-=b.side*.045;if(mood==='thinking')target-=b.side*.10;b.mesh.rotation.z+=(target-b.mesh.rotation.z)*.12;});smile.scale.y+=((mood==='happy'?1.18:mood==='worried'?.88:1)-smile.scale.y)*.08;
  if(mood==='greeting'){const wave=Math.sin(t*4.6);parts.armL.shoulder.rotation.z=-.52+.035*Math.sin(t*2.1);parts.armL.elbow.rotation.z=-.48;parts.armR.shoulder.rotation.z=.72+.14*wave;parts.armR.elbow.rotation.z=-.42+.16*Math.sin(t*4.6+.7);parts.armR.hand.rotation.x=.16*Math.sin(t*4.6);parts.legL.hip.rotation.x=.025*Math.sin(t*2.3);parts.legR.hip.rotation.x=-.025*Math.sin(t*2.3);}
  else if(mood==='thinking'){parts.armL.shoulder.rotation.z=-.95+.025*Math.sin(t*1.5);parts.armL.elbow.rotation.z=-.45+.06*Math.sin(t*2);parts.armR.shoulder.rotation.z=.28+.04*Math.sin(t*1.4);parts.armR.elbow.rotation.z=-.6+.04*Math.sin(t*2);parts.armR.hand.rotation.x=.22+.04*Math.sin(t*2.4);head.rotation.z=.08+.018*Math.sin(t*1.7);parts.legL.hip.rotation.x=0;parts.legR.hip.rotation.x=0;}
  else if(mood==='worried'||pointing){parts.armR.shoulder.rotation.z=-1.05+.035*Math.sin(t*3);parts.armR.elbow.rotation.z=-.25+.035*Math.sin(t*2.6);parts.armR.hand.rotation.x=-.18;parts.armL.shoulder.rotation.z=.55+.035*Math.sin(t*2.2);parts.armL.elbow.rotation.z=-.5;head.rotation.z=-.07+.025*Math.sin(t*2.5);parts.legL.hip.rotation.x=.012*Math.sin(t*2);parts.legR.hip.rotation.x=-.012*Math.sin(t*2);}
  else if(mood==='happy'){parts.armL.shoulder.rotation.z=-1.25+.17*Math.sin(t*6);parts.armR.shoulder.rotation.z=1.15-.17*Math.sin(t*6);parts.armL.elbow.rotation.z=-.25+.08*Math.sin(t*6+.4);parts.armR.elbow.rotation.z=-.25-.08*Math.sin(t*6+.4);parts.armL.hand.rotation.x=.12*Math.sin(t*6);parts.armR.hand.rotation.x=-.12*Math.sin(t*6);hero.position.y=.045*Math.abs(Math.sin(t*4));parts.legL.hip.rotation.x=.18*Math.sin(t*5);parts.legR.hip.rotation.x=-.18*Math.sin(t*5);}
  else {parts.armR.shoulder.rotation.z=-.55+.06*Math.sin(t*1.8);parts.armR.elbow.rotation.z=-.2+.04*Math.sin(t*2.1);parts.armL.shoulder.rotation.z=.25+.04*Math.sin(t*1.4);parts.armL.elbow.rotation.z=-.12;parts.legL.hip.rotation.x=.025*Math.sin(t*1.8);parts.legR.hip.rotation.x=-.025*Math.sin(t*1.8);parts.armL.hand.rotation.x=.035*Math.sin(t*2.4);parts.armR.hand.rotation.x=-.04*Math.sin(t*2.1);}
  particles.forEach(p=>{p.mesh.position.y=.35+(Math.sin(t*1.4+p.phase)+1)*.55;p.mesh.position.x=Math.cos(t*.7+p.phase)*(.76+(p.phase%3)*.04);p.mesh.material.opacity=.5+.5*Math.sin(t*2+p.phase);});halo.rotation.z=t*.16;renderer.render(scene,camera);}
 function resize(){const w=canvas.clientWidth||220,h=canvas.clientHeight||280;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}new ResizeObserver(resize).observe(canvas);
 setMood('greeting',true);animate();window.dispatchEvent(new CustomEvent('cirp:mascot-mood',{detail:{mood:'greeting',message:'Namaste! I’m your CIRP hero. Let’s keep every milestone on track.'}}));
})();
