let pendingPackages=[],currentBatchPackages=[];
const TEST_MODE=false; // Set to false when Tesseract is working

async function processImages(){
    try{
        const files=document.getElementById('labelImages').files;
        if(!files.length)return alert('❌ Select images');
        
        const courier=document.getElementById('courier').value;
        document.getElementById('processing').innerHTML='⏳ Processing...';
        pendingPackages=[];
        
        for(let i=0;i<files.length;i++){
            const f=files[i];
            
            if(TEST_MODE){
                // TEST MODE - Skip OCR, create test package
                console.log('TEST MODE: Creating test package for',f.name);
                const pkg={
                    id:Date.now()+Math.random(),
                    courier,
                    name:'Test Customer',
                    trackingNumber:'TEST'+Math.floor(Math.random()*1000000000),
                    phone:'705-123-4567',
                    postalCode:'P5A 1M1',
                    city:'Elliot Lake',
                    province:'ON',
                    ocrImage:URL.createObjectURL(f),
                    ocrText:'TEST MODE - No OCR performed',
                    status:'Available for Pickup',
                    createdAt:new Date().toISOString(),
                    missingFields:[]
                };
                pendingPackages.push(pkg);
                continue;
            }
            
            // REAL MODE - Use Tesseract OCR
            try{
                if(typeof Tesseract==='undefined')throw new Error('Tesseract not loaded');
                
                document.getElementById('processing').innerHTML='⏳ '+(i+1)+'/'+files.length+': '+f.name+'...';
                
                const worker=await Tesseract.createWorker('eng');
                const{data}=await worker.recognize(f);
                const text=data.text;
                await worker.terminate();
                
                const pkg={
                    id:Date.now()+Math.random(),
                    courier,
                    name:text.match(/([A-Z][a-z]+ [A-Z][a-z]+)/)?.[1]||'',
                    trackingNumber:text.match(/\b[A-Z0-9]{10,}\b/)?.[0]||'',
                    phone:text.match(/(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/)?.[0]||'',
                    postalCode:text.match(/P5A\s*[12][A-Z0-9][0-9]/i)?.[0]||'',
                    city:'Elliot Lake',
                    province:'ON',
                    ocrImage:URL.createObjectURL(f),
                    ocrText:text,
                    status:'Available for Pickup',
                    createdAt:new Date().toISOString(),
                    missingFields:[]
                };
                
                if(!pkg.name)pkg.missingFields.push('Name');
                if(!pkg.trackingNumber)pkg.missingFields.push('Tracking');
                if(!pkg.postalCode)pkg.missingFields.push('Postal');
                
                pendingPackages.push(pkg);
            }catch(err){
                console.error('OCR Error:',err);
                alert('❌ OCR failed for '+f.name+':\n'+err.message+'\n\nTest mode is ON - using test data instead.');
                
                // Fallback to test data
                const pkg={
                    id:Date.now()+Math.random(),
                    courier,
                    name:'',
                    trackingNumber:'',
                    phone:'',
                    postalCode:'',
                    city:'Elliot Lake',
                    province:'ON',
                    ocrImage:URL.createObjectURL(f),
                    ocrText:'OCR FAILED',
                    status:'Available for Pickup',
                    createdAt:new Date().toISOString(),
                    missingFields:['Name','Tracking','Postal']
                };
                pendingPackages.push(pkg);
            }
        }
        
        showPendingPackages();
        document.getElementById('processing').innerHTML='✅ Done: '+pendingPackages.length;
        document.getElementById('continueOrFinish').classList.remove('hidden');
        
    }catch(err){
        console.error('Fatal:',err);
        alert('❌ Error: '+err.message);
        document.getElementById('processing').innerHTML='❌ Error';
    }
}

function showPendingPackages(){
    const c=document.getElementById('pendingPackages');
    c.innerHTML=pendingPackages.map((p,i)=>'<div class="package-card" style="border:2px solid '+(p.missingFields.length?'#dc3545':'#28a745')+'"><div style="display:grid;grid-template-columns:100px 1fr;gap:10px"><img src="'+p.ocrImage+'" width="100" style="border-radius:8px"><div><p><strong>Courier:</strong> '+p.courier+'</p><p><strong>Name:</strong> <input type="text" value="'+(p.name||'')+'" id="name_'+i+'" style="width:200px;padding:4px"></p><p><strong>Tracking:</strong> <input type="text" value="'+(p.trackingNumber||'')+'" id="track_'+i+'" style="width:200px;padding:4px"></p><p><strong>Phone:</strong> <input type="text" value="'+(p.phone||'')+'" id="phone_'+i+'" style="width:150px;padding:4px"></p><p><strong>Postal:</strong> <input type="text" value="'+(p.postalCode||'')+'" id="postal_'+i+'" style="width:100px;padding:4px"></p>'+(p.missingFields.length?'<p style="background:#f8d7da;padding:8px;border-radius:6px;color:#721c24">⚠️ Missing: '+p.missingFields.join(', ')+'</p>':'')+(TEST_MODE?'<p style="background:#fff3cd;padding:8px;border-radius:6px"><strong>TEST MODE ON</strong> - Edit fields manually</p>':'')+'<div class="btn-group"><button onclick="savePackageFromForm('+i+')" style="background:#28a745">✅ Save</button><button onclick="skipPackage('+i+')" class="secondary">⏭️ Skip</button></div></div></div></div>').join('');
}

function savePackageFromForm(i){
    const pkg=pendingPackages[i];
    pkg.name=document.getElementById('name_'+i).value.trim();
    pkg.trackingNumber=document.getElementById('track_'+i).value.trim();
    pkg.phone=document.getElementById('phone_'+i).value.trim();
    pkg.postalCode=document.getElementById('postal_'+i).value.trim();
    
    if(!pkg.name||!pkg.trackingNumber){
        alert('❌ Name and Tracking are required');
        return;
    }
    
    let customers=getCustomers(),customer=customers.find(c=>c.name.toLowerCase()===pkg.name.toLowerCase());
    if(!customer){
        customer={id:Date.now(),name:pkg.name,phone:pkg.phone,postalCode:pkg.postalCode,city:pkg.city,province:pkg.province};
        customers.push(customer);
        saveCustomers(customers);
    }
    
    pkg.customerId=customer.id;
    pkg.customerName=customer.name;
    currentBatchPackages.push(pkg);
    
    let packages=getPackages();
    packages.push(pkg);
    savePackages(packages);
    
    pendingPackages.splice(i,1);
    showPendingPackages();
    
    if(!pendingPackages.length){
        alert('✅ All packages saved!');
        document.getElementById('continueOrFinish').classList.remove('hidden');
    }
}

function skipPackage(i){pendingPackages.splice(i,1);showPendingPackages()}
function continueBatch(){document.getElementById('labelImages').value='';pendingPackages=[];document.getElementById('pendingPackages').innerHTML='';document.getElementById('processing').innerHTML='';document.getElementById('continueOrFinish').classList.add('hidden')}

function finishBatch(){
    if(!currentBatchPackages.length)return alert('No packages');
    const s={};
    currentBatchPackages.forEach(p=>{
        const n=p.customerName||p.name;
        if(!s[n])s[n]={phone:p.phone,count:0,packages:[]};
        s[n].count++;
        s[n].packages.push(p.trackingNumber);
    });
    document.getElementById('customerSummaryList').innerHTML=Object.entries(s).map(([n,d])=>'<div class="package-card"><h4>'+n+'</h4><p><strong>Phone:</strong> '+(d.phone||'N/A')+'</p><p><strong>Total Packages:</strong> <span style="font-size:1.5em;color:#28a745">'+d.count+'</span></p><p style="font-size:0.85em;opacity:0.7">'+d.packages.join(', ')+'</p></div>').join('');
    document.getElementById('ocrWorkflow').classList.add('hidden');
    document.getElementById('batchSummary').classList.remove('hidden');
}

function returnToMainMenu(){document.getElementById('batchSummary').classList.add('hidden');document.getElementById('ocrWorkflow').classList.remove('hidden');document.getElementById('continueOrFinish').classList.add('hidden');currentBatchPackages=[]}

function filterPackages(){
    const q=document.getElementById('filterInput').value.toLowerCase();
    if(!q){document.getElementById('packageList').innerHTML='<div class="package-card">Enter search term</div>';return}
    const filtered=getPackages().filter(p=>p.trackingNumber.toLowerCase().includes(q)||(p.name&&p.name.toLowerCase().includes(q))||(p.phone&&p.phone.includes(q)));
    document.getElementById('packageList').innerHTML=filtered.length?filtered.map(p=>'<div class="package-card"><div style="display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center"><div><strong style="font-size:1.1em">'+p.trackingNumber+'</strong><br>'+p.name+'<br><small>'+p.courier+' | '+new Date(p.createdAt).toLocaleDateString()+'</small></div><select class="status-select" onchange="updateStatus(\''+p.id+'\',this.value)"><option '+(p.status==='Available for Pickup'?'selected':'')+'>Available for Pickup</option><option '+(p.status==='Picked Up'?'selected':'')+'>Picked Up</option><option '+(p.status==='Sent Back'?'selected':'')+'>Sent Back</option><option '+(p.status==='Refused'?'selected':'')+'>Refused</option></select></div></div>').join(''):'<div class="package-card">No results for: '+q+'</div>';
}

function updateStatus(id,status){let ps=getPackages(),pkg=ps.find(p=>p.id==id);if(pkg){pkg.status=status;savePackages(ps);alert('✅ Updated')}}
