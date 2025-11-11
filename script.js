// Money Manager - Advanced version (categories + monthly summary + filters)
const STORAGE_KEY = 'money_manager_transactions_v1';

function $(id){return document.getElementById(id)}

let transactions = loadTransactions();
const form = $('transaction-form');
const tbody = document.querySelector('#transactions-table tbody');
const totalAmountEl = $('total-amount');
const filterCategory = $('filter-category');
const filterMonth = $('filter-month');
const searchText = $('search-text');
const sortBy = $('sort-by');

function loadTransactions(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){
    console.error('Failed to parse transactions', e);
    return [];
  }
}

function saveTransactions(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function formatCurrency(v){
  return '₹' + Number(v).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2});
}

function renderTransactions(){
  // apply filters
  let items = transactions.slice();

  const cat = filterCategory.value;
  const month = filterMonth.value;
  const search = searchText.value.trim().toLowerCase();

  if(cat !== 'All'){
    items = items.filter(t => t.category === cat);
  }
  if(month){
    // month is YYYY-MM
    items = items.filter(t => t.date.startsWith(month));
  }
  if(search){
    items = items.filter(t => t.description.toLowerCase().includes(search));
  }

  // sorting
  const sort = sortBy.value;
  if(sort === 'date_desc') items.sort((a,b)=> b.date.localeCompare(a.date));
  if(sort === 'date_asc') items.sort((a,b)=> a.date.localeCompare(b.date));
  if(sort === 'amount_desc') items.sort((a,b)=> b.amount - a.amount);
  if(sort === 'amount_asc') items.sort((a,b)=> a.amount - b.amount);

  tbody.innerHTML = '';
  let total = 0;
  items.forEach((t, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${t.date}</td>
                    <td>${escapeHtml(t.description)}</td>
                    <td>${t.category}</td>
                    <td>${formatCurrency(t.amount)}</td>
                    <td><button data-idx="${idx}" class="delete-btn">Delete</button></td>`;
    tbody.appendChild(tr);
    total += Number(t.amount);
  });

  totalAmountEl.textContent = formatCurrency(total);

  // attach delete handlers (index here is of filtered array -> need to map to original)
  document.querySelectorAll('.delete-btn').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      const filteredIndex = Number(btn.dataset.idx);
      // find item in displayed list:
      const displayed = items;
      const itemToDelete = displayed[filteredIndex];
      // find its index in original transactions (match by id or timestamp)
      const origIndex = transactions.findIndex(tt => tt.id === itemToDelete.id);
      if(origIndex > -1){
        if(confirm('Delete this transaction?')) {
          transactions.splice(origIndex,1);
          saveTransactions();
          renderTransactions();
          renderSummary();
        }
      }
    });
  });
}

function escapeHtml(s){
  return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
}

form.addEventListener('submit', (e)=>{
  e.preventDefault();
  const amount = parseFloat($('amount').value);
  const description = $('description').value || '';
  const category = $('category').value;
  const date = $('date').value;

  if(!date || isNaN(amount)){
    alert('Please provide valid date and amount.');
    return;
  }

  const tx = {
    id: Date.now() + '-' + Math.random().toString(36).slice(2,7),
    amount: Number(amount),
    description,
    category,
    date
  };
  transactions.push(tx);
  saveTransactions();
  form.reset();
  renderTransactions();
  renderSummary();
});

filterCategory.addEventListener('change', renderTransactions);
filterMonth.addEventListener('change', renderTransactions);
searchText.addEventListener('input', renderTransactions);
sortBy.addEventListener('change', renderTransactions);

$('clear-all').addEventListener('click', ()=>{
  if(confirm('Clear ALL transactions? This cannot be undone.')){
    transactions = [];
    saveTransactions();
    renderTransactions();
    renderSummary();
  }
});

$('export-csv').addEventListener('click', ()=>{
  if(transactions.length === 0){
    alert('No transactions to export.');
    return;
  }
  const rows = [['Date','Description','Category','Amount']];
  transactions.forEach(t => rows.push([t.date, t.description, t.category, t.amount]));
  const csv = rows.map(r => r.map(cell => '"' + String(cell).replace(/"/g,'""') + '"').join(',')).join('\n');
  const blob = new Blob([csv], {type: 'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'money_manager_transactions.csv';
  a.click();
  URL.revokeObjectURL(url);
});

function renderSummary(){
  // Build monthly summary grouped by category for the selected month.
  // If filterMonth is set, show summary for that month. Otherwise show last 3 months with totals.
  let html = '';
  const month = filterMonth.value;
  if(month){
    const monthItems = transactions.filter(t => t.date.startsWith(month));
    const byCategory = {};
    monthItems.forEach(t => {
      byCategory[t.category] = (byCategory[t.category]||0) + Number(t.amount);
    });
    html += `<h3>Summary for ${month}</h3>`;
    if(Object.keys(byCategory).length === 0) {
      html += '<p>No transactions in this month.</p>';
    } else {
      html += '<table class="summary-table"><thead><tr><th>Category</th><th>Total (₹)</th></tr></thead><tbody>';
      Object.entries(byCategory).forEach(([cat,amt])=>{
        html += `<tr><td>${cat}</td><td>${formatCurrency(amt)}</td></tr>`;
      });
      const monthTotal = Object.values(byCategory).reduce((a,b)=>a+b,0);
      html += `<tr class="summary-total"><td>Total</td><td>${formatCurrency(monthTotal)}</td></tr>`;
      html += '</tbody></table>';
    }
  } else {
    // show last 3 months totals
    const months = getLastNMonths(3);
    html += `<h3>Last ${months.length} Months Summary</h3>`;
    html += '<table class="summary-table"><thead><tr><th>Month</th><th>Category</th><th>Total (₹)</th></tr></thead><tbody>';
    months.forEach(m=>{
      const mItems = transactions.filter(t => t.date.startsWith(m));
      if(mItems.length === 0){
        html += `<tr><td>${m}</td><td colspan="2">No transactions</td></tr>`;
      } else {
        const byCat = {};
        mItems.forEach(t => byCat[t.category] = (byCat[t.category]||0)+Number(t.amount));
        Object.entries(byCat).forEach(([cat,amt])=>{
          html += `<tr><td>${m}</td><td>${cat}</td><td>${formatCurrency(amt)}</td></tr>`;
        });
        const monthTotal = mItems.reduce((s,i)=>s+Number(i.amount),0);
        html += `<tr class="summary-total"><td>${m}</td><td>Total</td><td>${formatCurrency(monthTotal)}</td></tr>`;
      }
    });
    html += '</tbody></table>';
  }

  $('summary-container').innerHTML = html;
}

function getLastNMonths(n){
  const res = [];
  const today = new Date();
  for(let i=0;i<n;i++){
    const d = new Date(today.getFullYear(), today.getMonth()-i, 1);
    const mm = String(d.getMonth()+1).padStart(2,'0');
    res.push(d.getFullYear() + '-' + mm);
  }
  return res;
}

// initial render
renderTransactions();
renderSummary();
