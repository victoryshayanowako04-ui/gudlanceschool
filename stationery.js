// Independent stationery ledger. Student stationery payments are read-only
// input for reporting; all stationery stock changes stay in this table.
window.stationeryProducts = [];
window.stationeryOrders = [];
window.stationeryMovements = [];
window.stationeryDistributions = [];
window.stationeryAssignmentCart = [];
window.stationeryDataLoaded = false;
window.stationeryCloudReady = false;
window.stationeryDataRevision = null;
window.stationeryDataLoading = null;
window.stationerySaveInProgress = false;

const STATIONERY_TABLE = 'school_stationery_ledger';
const STATIONERY_LEDGER_ID = 1;

const STATIONERY_HELP = {
    catalog: {
        title: 'Add a school supply',
        summary: 'Create a catalog entry for any supply the school may order or assign.',
        steps: [
            'Enter a clear item name and stock unit. Examples include books, pens, reams, boxes, or packs.',
            'Add a type, size, and identifying details so similar items are not confused.',
            'Select Add item to stationery catalog. New catalog items start with zero stock.',
            'Record an order and confirm each delivery before assigning the item to a student.'
        ],
        expected: 'The item appears in the stationery catalog and order selector with zero stock. Adding a catalog item does not record an order or change any school finances.'
    },
    order: {
        title: 'Record a stationery order',
        summary: 'An order is a commitment to buy an item; stock is not available until its delivery is received.',
        steps: [
            'Choose a catalog item, enter the quantity and cost per stock unit, and select the order date.',
            'Enter the supplier and academic period. Add any important size, grade, or delivery details.',
            'Review the estimated total and select Save stationery order.',
            'When goods arrive, use Receive an order into stock. Partial deliveries can be received in separate transactions.'
        ],
        expected: 'The order is saved in the independent ledger. On-hand stock stays unchanged until a received quantity is confirmed.'
    },
    receive: {
        title: 'Receive stationery stock',
        summary: 'Only goods physically received should be added to stock.',
        steps: [
            'Choose an open order. The selector shows the outstanding quantity.',
            'Enter the quantity that actually arrived, receipt date, and supplier name. You can receive less than the outstanding amount.',
            'Add a note for shortages, damaged goods, or delivery references.',
            'Select Confirm received quantity and wait for the cloud confirmation.'
        ],
        expected: 'The received quantity is added to stock at the ordered unit cost, an audit movement is saved, and the order remains open if some quantity is still outstanding.'
    },
    assign: {
        title: 'Assign stationery to a student',
        summary: 'Select a student first, then add as many different stationery items as required.',
        steps: [
            'Students marked as using school stationery are labeled in the selector. Other active students remain selectable.',
            'Choose the item and quantity, then select Add item to student request. Repeat for every book or supply.',
            'Check the student, academic period, request lines, and estimated issue cost.',
            'Select Confirm student assignment. Stock is deducted only after the cloud confirms the complete assignment.'
        ],
        expected: 'A dated assignment with the student, item quantities, and cost-at-issue is recorded. Stock decreases by each assigned quantity. A reason is required when assigning to a student not marked for school stationery.'
    },
    stock: {
        title: 'Read stationery stock',
        summary: 'This table shows available quantities and their current average cost.',
        steps: [
            'Check item, type, size, stock unit, quantity on hand, and average cost per unit.',
            'Only confirmed deliveries increase stock; student assignments reduce it.',
            'Use the order history to check goods still outstanding from suppliers.',
            'Expand this stock table and use the Chief Admin actions at the right of each item to edit details, clear stock, or remove an empty item.',
            'Use the report for expected shortages, excess stock, and next-order estimates.'
        ],
        expected: 'The on-hand amount is maintained by received-order and student-assignment records. It is not affected by student fees, grocery stock, shop sales, or finance entries.'
    },
    orders: {
        title: 'Read order history',
        summary: 'Orders and deliveries are kept separately so pending supplier quantities are visible.',
        steps: [
            'Ordered is the quantity committed to buy; received is the quantity confirmed as delivered.',
            'A partial delivery remains open until the full order quantity is received.',
            'Unit and total costs are recorded for analysis in stationery reports.'
        ],
        expected: 'The table shows each order, delivery progress, supplier, period, and order details. Recording an order alone never increases on-hand stock.'
    },
    history: {
        title: 'Read student assignment history',
        summary: 'Every confirmed assignment is preserved with the student and item details.',
        steps: [
            'Review the date, academic period, student, assigned items, and cost at the time of issue.',
            'Multiple books and supplies can be assigned to a student in one transaction.',
            'The recorded issue cost is compared with stationery payments allocated to that student.'
        ],
        expected: 'Assignment history is independent of student billing and payment records. It provides the quantity and cost evidence used in distribution and profit/loss reports.'
    },
    report: {
        title: 'Understand the stationery report',
        summary: 'The report compares supplier orders and deliveries with student assignments and actual allocated stationery payments.',
        steps: [
            'Choose dates and generate the report. Leaving dates blank includes all available history.',
            'Ordered cost is the value of orders placed; received purchase cost is the value of deliveries confirmed.',
            'Student income includes only non-void payment entries explicitly allocated to Stationery. Charges, waivers, credits, and unallocated payments are excluded.',
            'Surplus or loss is allocated stationery payments less the cost of stationery issued in the selected period.',
            'Shortage and excess compare forecast need with current stock and open orders. Forecasts use average quantity per recipient across recorded periods and current stationery-user enrollment.'
        ],
        expected: 'The report shows order cost, received cost, actual allocated student payments, issue cost, surplus or loss, student-level comparisons, distribution totals, and an estimated next order. The estimate is advisory and does not place an order.'
    }
};

const STATIONERY_PALETTE = [
    { accent: '#1d4ed8', tint: '#eff6ff' },
    { accent: '#b45309', tint: '#fff7ed' },
    { accent: '#0f766e', tint: '#ecfdf5' },
    { accent: '#6d28d9', tint: '#f5f3ff' },
    { accent: '#be185d', tint: '#fdf2f8' },
    { accent: '#15803d', tint: '#f0fdf4' },
    { accent: '#c2410c', tint: '#fff7ed' }
];

function stationeryEscape(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function stationeryRound(value, places) {
    const scale = 10 ** places;
    return Math.round((Number(value) + Number.EPSILON) * scale) / scale;
}

function stationeryMoney(value) {
    return `$${(Number(value) || 0).toFixed(2)}`;
}

function stationeryQuantity(value) {
    return stationeryRound(Number(value) || 0, 3).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function stationeryDateValid(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function stationeryToday() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function stationeryCurrentPeriod() {
    const date = new Date();
    const month = date.getMonth() + 1;
    const term = month <= 4 ? 1 : month <= 8 ? 2 : 3;
    return `${date.getFullYear()} Term ${term}`;
}

function stationeryActor() {
    const user = window.currentUser || {};
    return String(user.name || user.user || user.username || 'Staff');
}

function stationeryRoleAllowed() {
    const role = window.getNormalizedRole(window.currentUser && window.currentUser.role);
    return ['Level 2', 'Level 3', 'God Mode'].includes(role);
}

function stationeryCanManageCatalog() {
    return window.getNormalizedRole(window.currentUser && window.currentUser.role) === 'Level 3';
}

function showStationeryStatus(message, isError, title) {
    const status = document.getElementById('stationeryStatus');
    const messageElement = document.getElementById('stationeryStatusMessage');
    const titleElement = document.getElementById('stationeryStatusTitle');
    const icon = document.getElementById('stationeryStatusIcon');
    if (!status || !messageElement || !titleElement || !icon) return;
    const pending = title === 'Saving' || title === 'Loading';
    const variant = pending ? 'pending' : isError ? 'error' : 'success';
    status.className = `grocery-notification grocery-notification--${variant}`;
    titleElement.textContent = title || (isError ? 'Action required' : 'Completed');
    messageElement.textContent = message;
    icon.textContent = pending ? '…' : isError ? '!' : '✓';
    status.setAttribute('role', isError ? 'alert' : 'status');
    status.setAttribute('aria-live', isError ? 'assertive' : 'polite');
    status.style.display = 'flex';
}

window.dismissStationeryStatus = function() {
    const status = document.getElementById('stationeryStatus');
    if (status) status.style.display = 'none';
};

function requireStationeryWriteAccess() {
    if (!stationeryRoleAllowed()) {
        showStationeryStatus('Access denied. Admin staff are required to manage stationery stock.', true);
        return false;
    }
    if (!window.appDataReady || !window.stationeryDataLoaded || !window.stationeryCloudReady) {
        showStationeryStatus('Stationery changes are disabled until school and stationery data are verified from the cloud.', true);
        return false;
    }
    if (window.stationerySaveInProgress) {
        showStationeryStatus('A stationery transaction is still being verified. Wait for its result before starting another change.', true);
        return false;
    }
    if (!navigator.onLine || !window.supabaseClient) {
        showStationeryStatus('Reconnect and reload Stationery Stock before recording a change.', true);
        return false;
    }
    return true;
}

function stationeryActiveStudents() {
    return (Array.isArray(window.students) ? window.students : [])
        .filter(student => student && student.id != null && ['active', 'pending_payment'].includes(
            String(student.enrollmentStatus || student.enrollment_status || student.status || 'active').toLowerCase()
        ))
        .map(student => ({
            ...student,
            stationeryUser: student.stationeryPack === true || student.stationery_pack === true ||
                String(student.stationeryPack || student.stationery_pack).toLowerCase() === 'true'
        }))
        .sort((a, b) => Number(b.stationeryUser) - Number(a.stationeryUser) ||
            String(a.name || '').localeCompare(String(b.name || '')));
}

function stationeryFindProduct(productId) {
    return window.stationeryProducts.find(item => String(item.id) === String(productId));
}

function stationeryFormatProduct(item) {
    return `${item.name}${item.category ? ` / ${item.category}` : ''}${item.size ? ` / ${item.size}` : ''} (${item.unit})`;
}

function stationeryOrderRemaining(order) {
    if (order.status === 'CANCELLED') return 0;
    return Math.max(0, stationeryRound(Number(order.quantityOrdered) - Number(order.quantityReceived || 0), 3));
}

function initializeStationerySectionCollapses() {
    document.querySelectorAll('#stationery .card').forEach((card, index) => {
        if (card.dataset.stationeryCollapseInitialized === 'true') return;
        const heading = card.querySelector('h2, h3, h4');
        const header = card.firstElementChild;
        const title = heading ? heading.textContent.trim().replace(/\s+/g, ' ') : '';
        if (!header || !heading || !header.contains(heading) || !title) return;
        const colors = STATIONERY_PALETTE[index % STATIONERY_PALETTE.length];
        card.style.setProperty('--stationery-section-accent', colors.accent);
        card.style.setProperty('--stationery-section-tint', colors.tint);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn-standard stationery-section-toggle';
        button.textContent = 'Expand';
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-label', `Expand ${title}`);
        button.title = `Expand ${title}`;
        button.addEventListener('click', () => {
            const expanded = button.getAttribute('aria-expanded') !== 'true';
            card.classList.toggle('stationery-section-collapsed', !expanded);
            button.textContent = expanded ? 'Collapse' : 'Expand';
            button.setAttribute('aria-expanded', String(expanded));
            button.setAttribute('aria-label', `${expanded ? 'Collapse' : 'Expand'} ${title}`);
            button.title = `${expanded ? 'Collapse' : 'Expand'} ${title}`;
        });
        header.classList.add('stationery-section-heading');
        header.appendChild(button);
        card.classList.add('stationery-section-collapsible');
        card.classList.add('stationery-section-collapsed');
        card.dataset.stationeryCollapseInitialized = 'true';
    });
}

window.showStationeryHelp = function(guideKey) {
    const guide = STATIONERY_HELP[guideKey];
    if (!guide) {
        showStationeryStatus('That stationery guide is unavailable. Reload the section and try again.', true);
        return;
    }
    document.getElementById('stationeryHelpTitle').textContent = guide.title;
    document.getElementById('stationeryHelpSummary').textContent = guide.summary;
    document.getElementById('stationeryHelpSteps').innerHTML = guide.steps
        .map(step => `<li>${stationeryEscape(step)}</li>`).join('');
    document.getElementById('stationeryHelpExpected').textContent = guide.expected;
    document.getElementById('stationeryHelpModal').style.display = 'flex';
};

window.closeStationeryHelp = function() {
    const modal = document.getElementById('stationeryHelpModal');
    if (modal) modal.style.display = 'none';
};

function validateStationeryData(data) {
    const keys = ['products', 'orders', 'movements', 'distributions'];
    if (!data) return;
    keys.forEach(key => {
        if (!Array.isArray(data[key])) throw new Error(`The stationery ${key} list is invalid.`);
    });
    const validProducts = data.products.every(item => item && item.id != null && item.name && item.unit &&
        Number.isFinite(Number(item.quantityOnHand)) && Number(item.quantityOnHand) >= 0 &&
        Number.isFinite(Number(item.averageUnitCost)) && Number(item.averageUnitCost) >= 0);
    if (!validProducts) throw new Error('The saved stationery catalog contains an invalid item or stock amount.');
    const validOrders = data.orders.every(order => order && order.id != null && order.productId != null &&
        order.itemName && order.unit && order.supplier && order.period &&
        Number.isFinite(Number(order.quantityOrdered)) && Number(order.quantityOrdered) > 0 &&
        Number.isFinite(Number(order.quantityReceived || 0)) && Number(order.quantityReceived || 0) >= 0 &&
        Number(order.quantityReceived || 0) <= Number(order.quantityOrdered) &&
        Number.isFinite(Number(order.unitCost)) && Number(order.unitCost) >= 0 &&
        Number.isFinite(Number(order.totalCost)) && Number(order.totalCost) >= 0 &&
        ['OPEN', 'PARTIAL', 'RECEIVED', 'CANCELLED'].includes(order.status));
    const validMovements = data.movements.every(movement => movement && movement.id != null &&
        ['RECEIVED', 'ISSUED', 'ADJUSTMENT', 'PRODUCT_EDITED', 'PRODUCT_ARCHIVED'].includes(movement.type) && movement.productId != null &&
        movement.itemName && movement.unit &&
        Number.isFinite(Number(movement.quantity)) &&
        (['PRODUCT_EDITED', 'PRODUCT_ARCHIVED'].includes(movement.type) ? Number(movement.quantity) === 0 : Number(movement.quantity) > 0) &&
        Number.isFinite(Number(movement.unitCost)) && Number(movement.unitCost) >= 0 &&
        Number.isFinite(Number(movement.totalCost)) && Number(movement.totalCost) >= 0);
    const validDistributions = data.distributions.every(distribution => distribution &&
        distribution.id != null && distribution.studentId != null && distribution.date &&
        distribution.period && Array.isArray(distribution.lines) && distribution.lines.length > 0 &&
        Number.isFinite(Number(distribution.totalCost)) && Number(distribution.totalCost) >= 0 &&
        distribution.lines.every(line => line && line.productId != null && line.itemName && line.unit &&
            Number.isFinite(Number(line.quantity)) && Number(line.quantity) > 0 &&
            Number.isFinite(Number(line.unitCost)) && Number(line.unitCost) >= 0 &&
            Number.isFinite(Number(line.totalCost)) && Number(line.totalCost) >= 0));
    if (!validOrders || !validMovements || !validDistributions) {
        throw new Error('The saved stationery history contains an invalid record.');
    }
}

window.loadStationeryData = async function() {
    if (!stationeryRoleAllowed()) {
        showStationeryStatus('Access denied. Stationery Stock is available to admin staff only.', true);
        return;
    }
    if (!window.appDataReady) {
        showStationeryStatus('Wait for verified school and student records to finish loading, then reopen Stationery Stock.', true);
        return;
    }
    if (window.stationeryDataLoading) return window.stationeryDataLoading;
    if (window.stationerySaveInProgress) {
        showStationeryStatus('Wait for the current stationery transaction to finish before reloading the ledger.', true);
        return;
    }

    window.stationeryDataLoading = (async () => {
        window.stationeryCloudReady = false;
        window.stationeryDataLoaded = false;
        window.stationeryProducts = [];
        window.stationeryOrders = [];
        window.stationeryMovements = [];
        window.stationeryDistributions = [];
        window.stationeryDataRevision = null;
        window.renderStationeryModule();
        const today = stationeryToday();
        ['stationeryOrderDate', 'stationeryReceiveDate', 'stationeryAssignDate'].forEach(id => {
            const input = document.getElementById(id);
            if (input && !input.value) input.value = today;
        });
        ['stationeryOrderPeriod', 'stationeryAssignPeriod'].forEach(id => {
            const input = document.getElementById(id);
            if (input && !input.value) input.value = stationeryCurrentPeriod();
        });
        showStationeryStatus('Loading the independent stationery ledger and verified student list.', false, 'Loading');
        if (!navigator.onLine || !window.supabaseClient) {
            window.stationeryDataLoaded = false;
            showStationeryStatus('Cannot verify current stationery stock while offline. Reconnect and reopen Stationery Stock.', true);
            return;
        }
        try {
            const { data, error } = await window.supabaseClient
                .from(STATIONERY_TABLE)
                .select('products,orders,movements,distributions,last_updated')
                .eq('id', STATIONERY_LEDGER_ID)
                .maybeSingle();
            if (error) throw error;
            validateStationeryData(data);
            window.stationeryProducts = data ? data.products : [];
            window.stationeryOrders = data ? data.orders : [];
            window.stationeryMovements = data ? data.movements : [];
            window.stationeryDistributions = data ? data.distributions : [];
            window.stationeryDataRevision = data ? data.last_updated : null;
            window.stationeryDataLoaded = true;
            window.stationeryCloudReady = true;
            window.renderStationeryModule();
            showStationeryStatus(data
                ? 'Stationery stock and order history verified from the independent cloud ledger.'
                : 'The stationery ledger is verified and empty. Add a catalog item to get started.', false);
        } catch (error) {
            window.stationeryDataLoaded = false;
            window.stationeryCloudReady = false;
            console.error('Stationery ledger load failed:', error);
            const missingTable = error && ['42P01', 'PGRST205'].includes(error.code);
            showStationeryStatus(missingTable
                ? 'The stationery table is not installed. Run database/school_stationery_ledger.sql in the Supabase SQL Editor, then reopen Stationery Stock.'
                : `Could not verify stationery stock from Supabase: ${error.message || 'Unknown database error'}. Changes are disabled to protect current stock.`, true);
            window.renderStationeryModule();
        }
    })();
    try {
        await window.stationeryDataLoading;
    } finally {
        window.stationeryDataLoading = null;
    }
};

async function saveStationeryData() {
    if (!window.stationeryCloudReady || !navigator.onLine || !window.supabaseClient) {
        throw new Error('Stationery data is not verified online. Reopen Stationery Stock while connected before changing quantities.');
    }
    const now = new Date().toISOString();
    const stationeryData = {
        products: window.stationeryProducts,
        orders: window.stationeryOrders,
        movements: window.stationeryMovements,
        distributions: window.stationeryDistributions
    };
    let response;
    if (window.stationeryDataRevision) {
        response = await window.supabaseClient.from(STATIONERY_TABLE)
            .update({ ...stationeryData, last_updated: now })
            .eq('id', STATIONERY_LEDGER_ID)
            .eq('last_updated', window.stationeryDataRevision)
            .select('id');
        if (response.error) throw response.error;
        if (!response.data || response.data.length !== 1) {
            window.stationeryCloudReady = false;
            throw new Error('Stationery stock changed in another session. Reload the section before trying again.');
        }
    } else {
        response = await window.supabaseClient.from(STATIONERY_TABLE)
            .insert({ id: STATIONERY_LEDGER_ID, ...stationeryData, last_updated: now })
            .select('id');
        if (response.error) {
            if (response.error.code === '23505') {
                window.stationeryCloudReady = false;
                throw new Error('Another session initialized the stationery ledger. Reload the section before trying again.');
            }
            throw response.error;
        }
        if (!response.data || response.data.length !== 1) {
            throw new Error('The database did not confirm the new stationery ledger.');
        }
    }
    window.stationeryDataRevision = now;
}

async function commitStationeryChange(change, successMessage) {
    if (window.stationerySaveInProgress) {
        throw new Error('Another stationery transaction is still being verified.');
    }
    const previous = JSON.stringify({
        products: window.stationeryProducts,
        orders: window.stationeryOrders,
        movements: window.stationeryMovements,
        distributions: window.stationeryDistributions
    });
    window.stationerySaveInProgress = true;
    showStationeryStatus('Saving stationery changes and verifying with the cloud. Please wait.', false, 'Saving');
    try {
        change();
        await saveStationeryData();
        window.renderStationeryModule();
        showStationeryStatus(successMessage, false);
    } catch (error) {
        const restored = JSON.parse(previous);
        window.stationeryProducts = restored.products;
        window.stationeryOrders = restored.orders;
        window.stationeryMovements = restored.movements;
        window.stationeryDistributions = restored.distributions;
        window.renderStationeryModule();
        showStationeryStatus(`Stationery transaction was not saved. ${error.message || 'Unknown database error'} Next: reload verified stationery data before retrying.`, true);
        throw error;
    } finally {
        window.stationerySaveInProgress = false;
    }
}

window.addStationeryProduct = async function() {
    if (!requireStationeryWriteAccess()) return;
    const name = document.getElementById('stationeryProductName').value.trim();
    const category = document.getElementById('stationeryProductCategory').value.trim();
    const size = document.getElementById('stationeryProductSize').value.trim();
    const unit = document.getElementById('stationeryProductUnit').value.trim();
    const details = document.getElementById('stationeryProductDetails').value.trim();
    if (!name || !unit) return showStationeryStatus('Item name and stock unit are required.', true);
    const normalize = value => String(value).trim().toLowerCase();
    const duplicate = window.stationeryProducts.some(item =>
        normalize(item.name) === normalize(name) &&
        normalize(item.category || '') === normalize(category) &&
        normalize(item.size || '') === normalize(size) &&
        normalize(item.unit) === normalize(unit)
    );
    if (duplicate) return showStationeryStatus('This item, type, size, and unit already exist. Select it from the order list instead.', true);
    const product = {
        id: `STP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name, category, size, unit, details,
        quantityOnHand: 0,
        averageUnitCost: 0,
        createdAt: new Date().toISOString(),
        createdBy: stationeryActor(),
        active: true
    };
    try {
        await commitStationeryChange(() => window.stationeryProducts.push(product),
            'Catalog item saved. It has zero stock until an order delivery is received. Next: record an order for this item.');
        ['stationeryProductName', 'stationeryProductCategory', 'stationeryProductSize', 'stationeryProductUnit', 'stationeryProductDetails']
            .forEach(id => { document.getElementById(id).value = ''; });
    } catch (error) {
        console.error('Stationery catalog item was not saved:', error);
    }
};

window.updateStationeryOrderEstimate = function() {
    const quantity = Number(document.getElementById('stationeryOrderQuantity')?.value);
    const unitCost = Number(document.getElementById('stationeryOrderUnitCost')?.value);
    const output = document.getElementById('stationeryOrderEstimate');
    if (output) output.textContent = quantity > 0 && unitCost >= 0 && Number.isFinite(quantity) && Number.isFinite(unitCost)
        ? stationeryMoney(quantity * unitCost)
        : '$0.00';
};

window.createStationeryOrder = async function() {
    if (!requireStationeryWriteAccess()) return;
    const product = stationeryFindProduct(document.getElementById('stationeryOrderProduct').value);
    const quantityText = document.getElementById('stationeryOrderQuantity').value.trim();
    const quantity = Number(quantityText);
    const unitCostText = document.getElementById('stationeryOrderUnitCost').value.trim();
    const unitCost = Number(unitCostText);
    const orderDate = document.getElementById('stationeryOrderDate').value;
    const supplier = document.getElementById('stationeryOrderSupplier').value.trim();
    const period = document.getElementById('stationeryOrderPeriod').value.trim();
    const details = document.getElementById('stationeryOrderDetails').value.trim();
    if (!product || !product.active) return showStationeryStatus('Select an active catalog item before recording an order.', true);
    if (!quantityText || !Number.isFinite(quantity) || quantity <= 0 || stationeryRound(quantity, 3) !== quantity) {
        return showStationeryStatus('Order quantity must be greater than zero and use no more than 3 decimal places.', true);
    }
    if (!unitCostText || !Number.isFinite(unitCost) || unitCost < 0 || stationeryRound(unitCost, 2) !== unitCost) {
        return showStationeryStatus('Enter a non-negative unit cost with no more than 2 decimal places.', true);
    }
    if (!stationeryDateValid(orderDate)) return showStationeryStatus('Select a valid order date.', true);
    if (orderDate > stationeryToday()) return showStationeryStatus('Order date cannot be in the future.', true);
    if (!supplier || !period) return showStationeryStatus('Supplier and academic period are required for an order.', true);
    const order = {
        id: `STO-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        productId: product.id,
        itemName: product.name,
        category: product.category || '',
        size: product.size || '',
        unit: product.unit,
        quantityOrdered: stationeryRound(quantity, 3),
        quantityReceived: 0,
        unitCost: stationeryRound(unitCost, 2),
        totalCost: stationeryRound(quantity * unitCost, 2),
        orderDate,
        supplier,
        period,
        details,
        status: 'OPEN',
        createdAt: new Date().toISOString(),
        createdBy: stationeryActor()
    };
    try {
        await commitStationeryChange(() => window.stationeryOrders.push(order),
            'Order recorded in the independent stationery ledger. Stock remains unchanged until delivery is confirmed. Next: receive the items when they arrive.');
        ['stationeryOrderQuantity', 'stationeryOrderUnitCost', 'stationeryOrderSupplier', 'stationeryOrderDetails']
            .forEach(id => { document.getElementById(id).value = ''; });
        window.updateStationeryOrderEstimate();
    } catch (error) {
        console.error('Stationery order was not saved:', error);
    }
};

window.receiveStationeryOrder = async function() {
    if (!requireStationeryWriteAccess()) return;
    const order = window.stationeryOrders.find(item =>
        String(item.id) === String(document.getElementById('stationeryReceiveOrder').value)
    );
    const quantityText = document.getElementById('stationeryReceiveQuantity').value.trim();
    const quantity = Number(quantityText);
    const date = document.getElementById('stationeryReceiveDate').value;
    const note = document.getElementById('stationeryReceiveNote').value.trim();
    const receivedSupplier = document.getElementById('stationeryReceiveSupplier').value.trim();
    if (!order) return showStationeryStatus('Select an open order before receiving stock.', true);
    const remaining = stationeryOrderRemaining(order);
    if (!quantityText || !Number.isFinite(quantity) || quantity <= 0 || stationeryRound(quantity, 3) !== quantity) {
        return showStationeryStatus('Received quantity must be greater than zero and use no more than 3 decimal places.', true);
    }
    if (quantity > remaining) return showStationeryStatus(`Only ${stationeryQuantity(remaining)} ${order.unit} remain outstanding on this order.`, true);
    if (!stationeryDateValid(date)) return showStationeryStatus('Select a valid received date.', true);
    if (date > stationeryToday()) return showStationeryStatus('Received date cannot be in the future.', true);
    if (!receivedSupplier) return showStationeryStatus('Record the supplier name at receipt.', true);
    const product = stationeryFindProduct(order.productId);
    if (!product) return showStationeryStatus('The catalog item for this order is missing. No stock was received.', true);
    const oldQuantity = Number(product.quantityOnHand) || 0;
    const oldValue = oldQuantity * (Number(product.averageUnitCost) || 0);
    const nextQuantity = stationeryRound(oldQuantity + quantity, 3);
    const nextAverageCost = nextQuantity > 0
        ? stationeryRound((oldValue + quantity * Number(order.unitCost)) / nextQuantity, 4)
        : Number(order.unitCost);
    const receiptId = `STR-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nextReceived = stationeryRound(Number(order.quantityReceived || 0) + quantity, 3);
    const movement = {
        id: receiptId,
        type: 'RECEIVED',
        orderId: order.id,
        productId: product.id,
        itemName: product.name,
        category: product.category || '',
        size: product.size || '',
        unit: product.unit,
        quantity,
        unitCost: Number(order.unitCost),
        totalCost: stationeryRound(quantity * Number(order.unitCost), 2),
        stockAfter: nextQuantity,
        date,
        period: order.period,
        supplier: receivedSupplier,
        note,
        actor: stationeryActor(),
        createdAt: new Date().toISOString()
    };
    try {
        await commitStationeryChange(() => {
            product.quantityOnHand = nextQuantity;
            product.averageUnitCost = nextAverageCost;
            order.quantityReceived = nextReceived;
            order.status = nextReceived >= Number(order.quantityOrdered) ? 'RECEIVED' : 'PARTIAL';
            order.updatedAt = new Date().toISOString();
            window.stationeryMovements.push(movement);
        }, `Received ${stationeryQuantity(quantity)} ${product.unit} of ${product.name} and updated stock. Next: check the stock table and order progress.`);
        document.getElementById('stationeryReceiveQuantity').value = '';
        document.getElementById('stationeryReceiveNote').value = '';
    } catch (error) {
        console.error('Stationery order receipt was not saved:', error);
    }
};

window.prefillStationeryReceiveSupplier = function() {
    const orderId = document.getElementById('stationeryReceiveOrder')?.value || '';
    const order = window.stationeryOrders.find(item => String(item.id) === String(orderId));
    const supplierInput = document.getElementById('stationeryReceiveSupplier');
    if (supplierInput) supplierInput.value = order ? String(order.supplier || '') : '';
};

window.updateStationeryAssignEstimate = function() {
    const product = stationeryFindProduct(document.getElementById('stationeryAssignProduct')?.value);
    const quantity = Number(document.getElementById('stationeryAssignQuantity')?.value);
    const estimate = document.getElementById('stationeryAssignEstimate');
    if (estimate) estimate.value = product && quantity > 0
        ? stationeryMoney(quantity * (Number(product.averageUnitCost) || 0))
        : '';
};

window.addStationeryAssignmentLine = function() {
    if (!requireStationeryWriteAccess()) return;
    const studentId = document.getElementById('stationeryAssignStudent').value;
    const product = stationeryFindProduct(document.getElementById('stationeryAssignProduct').value);
    const quantityText = document.getElementById('stationeryAssignQuantity').value.trim();
    const quantity = Number(quantityText);
    if (!studentId) return showStationeryStatus('Select the student who will receive these items first.', true);
    if (!product || !product.active) return showStationeryStatus('Select an active stationery item.', true);
    if (!quantityText || !Number.isFinite(quantity) || quantity <= 0 || stationeryRound(quantity, 3) !== quantity) {
        return showStationeryStatus('Assignment quantity must be greater than zero and use no more than 3 decimal places.', true);
    }
    const existing = window.stationeryAssignmentCart.find(line => String(line.productId) === String(product.id));
    const requested = quantity + (existing ? Number(existing.quantity) : 0);
    if (requested > Number(product.quantityOnHand)) {
        return showStationeryStatus(`Only ${stationeryQuantity(product.quantityOnHand)} ${product.unit} of ${product.name} are in stock.`, true);
    }
    if (existing) existing.quantity = stationeryRound(requested, 3);
    else window.stationeryAssignmentCart.push({ productId: product.id, quantity: stationeryRound(quantity, 3) });
    document.getElementById('stationeryAssignQuantity').value = '';
    window.updateStationeryAssignEstimate();
    renderStationeryAssignmentCart();
};

window.removeStationeryAssignmentLine = function(index) {
    if (!Number.isInteger(index) || index < 0 || index >= window.stationeryAssignmentCart.length) {
        return showStationeryStatus('That draft item is no longer available. Review the request and try again.', true);
    }
    window.stationeryAssignmentCart.splice(index, 1);
    renderStationeryAssignmentCart();
};

function renderStationeryAssignmentCart() {
    const tbody = document.getElementById('stationeryAssignRows');
    const total = document.getElementById('stationeryAssignTotal');
    if (!tbody || !total) return;
    let sum = 0;
    tbody.innerHTML = window.stationeryAssignmentCart.length
        ? window.stationeryAssignmentCart.map((line, index) => {
            const item = stationeryFindProduct(line.productId);
            if (!item) return '<tr><td colspan="4" style="padding:8px; color:#b91c1c;">An item in this draft is no longer active. Remove it before submitting.</td></tr>';
            const lineCost = Number(line.quantity) * (Number(item.averageUnitCost) || 0);
            sum += lineCost;
            return `<tr style="border-top:1px solid #e2e8f0;">
                <td style="padding:7px;">${stationeryEscape(stationeryFormatProduct(item))}</td>
                <td style="padding:7px; text-align:right;">${stationeryQuantity(line.quantity)} ${stationeryEscape(item.unit)}</td>
                <td style="padding:7px; text-align:right;">${stationeryMoney(lineCost)}</td>
                <td style="padding:7px; text-align:right;"><button type="button" class="btn-standard btn-danger" data-index="${index}" onclick="window.removeStationeryAssignmentLine(Number(this.dataset.index))" style="padding:4px 7px;">Remove</button></td>
            </tr>`;
        }).join('')
        : '<tr><td colspan="4" style="padding:8px; color:#64748b;">Choose a student and add one or more items.</td></tr>';
    total.textContent = stationeryMoney(sum);
};

window.assignStationeryToStudent = async function() {
    if (!requireStationeryWriteAccess()) return;
    const student = stationeryActiveStudents().find(item =>
        String(item.id) === String(document.getElementById('stationeryAssignStudent').value)
    );
    const date = document.getElementById('stationeryAssignDate').value;
    const period = document.getElementById('stationeryAssignPeriod').value.trim();
    const note = document.getElementById('stationeryAssignNote').value.trim();
    if (!student) return showStationeryStatus('Select a current active student before confirming an assignment.', true);
    if (!window.stationeryAssignmentCart.length) return showStationeryStatus('Add at least one stationery item to the student request.', true);
    if (!stationeryDateValid(date)) return showStationeryStatus('Select a valid stationery issue date.', true);
    if (date > stationeryToday()) return showStationeryStatus('Issue date cannot be in the future.', true);
    if (!period) return showStationeryStatus('Enter the academic period for this student assignment.', true);
    if (!student.stationeryUser && !note) {
        return showStationeryStatus('Add a short reason when assigning stationery to a student not marked as a stationery user.', true);
    }
    const lines = window.stationeryAssignmentCart.map(line => ({
        line,
        product: stationeryFindProduct(line.productId)
    }));
    for (const { line, product } of lines) {
        if (!product || !product.active) return showStationeryStatus('A stationery item in this request is no longer active. Remove it and review the request.', true);
        if (!Number.isFinite(Number(line.quantity)) || Number(line.quantity) <= 0 ||
            stationeryRound(Number(line.quantity), 3) !== Number(line.quantity)) {
            return showStationeryStatus('The request contains an invalid item quantity. Remove it and enter a valid quantity.', true);
        }
        if (Number(line.quantity) > Number(product.quantityOnHand)) {
            return showStationeryStatus(`Insufficient stock for ${product.name}. Only ${stationeryQuantity(product.quantityOnHand)} ${product.unit} remain.`, true);
        }
    }
    const id = `STD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const distributionLines = lines.map(({ line, product }) => ({
        productId: product.id,
        itemName: product.name,
        category: product.category || '',
        size: product.size || '',
        unit: product.unit,
        quantity: stationeryRound(Number(line.quantity), 3),
        unitCost: Number(product.averageUnitCost) || 0,
        totalCost: stationeryRound(Number(line.quantity) * (Number(product.averageUnitCost) || 0), 2)
    }));
    const totalCost = stationeryRound(distributionLines.reduce((sum, line) => sum + line.totalCost, 0), 2);
    const distribution = {
        id,
        studentId: student.id,
        studentName: student.name || String(student.id),
        grade: student.grade || student.class || '',
        isStationeryUser: student.stationeryUser,
        period,
        date,
        note,
        lines: distributionLines,
        totalCost,
        actor: stationeryActor(),
        createdAt: new Date().toISOString()
    };
    const movements = lines.map(({ line, product }, index) => ({
        id: `STM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${index}`,
        type: 'ISSUED',
        distributionId: id,
        studentId: student.id,
        studentName: student.name || String(student.id),
        productId: product.id,
        itemName: product.name,
        category: product.category || '',
        size: product.size || '',
        unit: product.unit,
        quantity: stationeryRound(Number(line.quantity), 3),
        unitCost: Number(product.averageUnitCost) || 0,
        totalCost: distributionLines[index].totalCost,
        stockAfter: stationeryRound(Number(product.quantityOnHand) - Number(line.quantity), 3),
        period,
        date,
        note,
        actor: stationeryActor(),
        createdAt: new Date().toISOString()
    }));
    try {
        await commitStationeryChange(() => {
            lines.forEach(({ line, product }) => {
                product.quantityOnHand = stationeryRound(Number(product.quantityOnHand) - Number(line.quantity), 3);
            });
            window.stationeryDistributions.push(distribution);
            window.stationeryMovements.push(...movements);
        }, `Stationery assigned to ${student.name || student.id}; stock was deducted and the assignment was recorded. Next: review the assignment history or stock balance.`);
        window.stationeryAssignmentCart = [];
        document.getElementById('stationeryAssignQuantity').value = '';
        document.getElementById('stationeryAssignNote').value = '';
        renderStationeryAssignmentCart();
    } catch (error) {
        console.error('Student stationery assignment was not saved:', error);
    }
};

function renderStationerySelectors() {
    const productValue = document.getElementById('stationeryOrderProduct')?.value || '';
    const receiveValue = document.getElementById('stationeryReceiveOrder')?.value || '';
    const assignProductValue = document.getElementById('stationeryAssignProduct')?.value || '';
    const studentValue = document.getElementById('stationeryAssignStudent')?.value || '';
    const products = window.stationeryProducts.filter(item => item.active !== false)
        .slice().sort((a, b) => stationeryFormatProduct(a).localeCompare(stationeryFormatProduct(b)));
    const productOptions = products.map(item =>
        `<option value="${stationeryEscape(item.id)}">${stationeryEscape(stationeryFormatProduct(item))} — ${stationeryQuantity(item.quantityOnHand)} ${stationeryEscape(item.unit)} on hand</option>`
    ).join('');
    const orderSelect = document.getElementById('stationeryOrderProduct');
    if (orderSelect) {
        orderSelect.innerHTML = `<option value="">Select a catalog item</option>${productOptions}`;
        if (products.some(item => String(item.id) === productValue)) orderSelect.value = productValue;
    }
    const assignSelect = document.getElementById('stationeryAssignProduct');
    if (assignSelect) {
        const stocked = products.filter(item => Number(item.quantityOnHand) > 0);
        assignSelect.innerHTML = `<option value="">Select item in stock</option>${stocked.map(item =>
            `<option value="${stationeryEscape(item.id)}">${stationeryEscape(stationeryFormatProduct(item))} — ${stationeryQuantity(item.quantityOnHand)} ${stationeryEscape(item.unit)} available</option>`
        ).join('')}`;
        if (stocked.some(item => String(item.id) === assignProductValue)) assignSelect.value = assignProductValue;
    }
    const openOrders = window.stationeryOrders.filter(order => stationeryOrderRemaining(order) > 0)
        .slice().sort((a, b) => String(a.orderDate).localeCompare(String(b.orderDate)));
    const receiveSelect = document.getElementById('stationeryReceiveOrder');
    if (receiveSelect) {
        receiveSelect.innerHTML = `<option value="">Select an open order</option>${openOrders.map(order =>
            `<option value="${stationeryEscape(order.id)}">${stationeryEscape(order.itemName)} — ${stationeryQuantity(stationeryOrderRemaining(order))} ${stationeryEscape(order.unit)} outstanding · ${stationeryEscape(order.supplier)}</option>`
        ).join('')}`;
        if (openOrders.some(order => String(order.id) === receiveValue)) receiveSelect.value = receiveValue;
    }
    if (receiveSelect && !document.getElementById('stationeryReceiveSupplier')?.value) {
        window.prefillStationeryReceiveSupplier();
    }
    const activeStudents = stationeryActiveStudents();
    const studentSelect = document.getElementById('stationeryAssignStudent');
    if (studentSelect) {
        studentSelect.innerHTML = `<option value="">Select a student</option>${activeStudents.map(student =>
            `<option value="${stationeryEscape(student.id)}">${stationeryEscape(student.name || student.id)} (${stationeryEscape(student.id)}) — ${stationeryEscape(student.grade || student.class || 'No grade')} · ${student.stationeryUser ? 'Stationery user' : 'Other student'}</option>`
        ).join('')}`;
        if (activeStudents.some(student => String(student.id) === studentValue)) studentSelect.value = studentValue;
    }
    const userCount = activeStudents.filter(student => student.stationeryUser).length;
    const countText = document.getElementById('stationeryStudentCounts');
    if (countText) countText.textContent = `${userCount} active student(s) are marked as stationery users. ${activeStudents.length - userCount} other active student(s) remain selectable for exceptions.`;
    const target = document.getElementById('stationeryAssignStudent');
    const targetStudent = activeStudents.find(student => String(student.id) === String(target?.value || ''));
    const targetHint = document.getElementById('stationeryAssignTarget');
    if (targetHint) targetHint.textContent = targetStudent
        ? `Request for ${targetStudent.name || targetStudent.id}${targetStudent.stationeryUser ? ' · stationery user' : ' · exception student'}`
        : 'Select a student before adding items.';
}

window.updateStationeryAssignTarget = function() {
    const select = document.getElementById('stationeryAssignStudent');
    const targetHint = document.getElementById('stationeryAssignTarget');
    if (!select || !targetHint) return;
    const student = stationeryActiveStudents().find(item => String(item.id) === String(select.value));
    targetHint.textContent = student
        ? `Request for ${student.name || student.id}${student.stationeryUser ? ' · stationery user' : ' · exception student'}`
        : 'Select a student before adding items.';
};

function renderStationeryInventory() {
    const tbody = document.getElementById('stationeryInventoryRows');
    if (!tbody) return;
    const products = window.stationeryProducts.filter(item => item.active !== false).slice().sort((a, b) =>
        stationeryFormatProduct(a).localeCompare(stationeryFormatProduct(b))
    );
    tbody.innerHTML = products.length
        ? products.map(item => `<tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:8px;"><strong>${stationeryEscape(item.name)}</strong><br><small>${stationeryEscape(item.category || 'General')}${item.size ? ` · ${stationeryEscape(item.size)}` : ''}${item.details ? ` · ${stationeryEscape(item.details)}` : ''}</small></td>
            <td style="padding:8px;">${stationeryEscape(item.unit)}</td>
            <td style="padding:8px; text-align:right; font-weight:700;">${stationeryQuantity(item.quantityOnHand)}</td>
            <td style="padding:8px; text-align:right;">${stationeryMoney(item.averageUnitCost)}</td>
            <td style="padding:8px; text-align:right;">${stationeryMoney(Number(item.quantityOnHand) * Number(item.averageUnitCost))}</td>
            <td style="padding:8px; position:sticky; right:0; z-index:1; background:#fff; box-shadow:-4px 0 6px rgba(0,0,0,.06);">${stationeryCanManageCatalog()
                ? `<div style="display:flex; flex-direction:column; gap:4px; min-width:105px;">
                       <button type="button" class="btn-standard btn-primary inventory-row-action" data-product-id="${stationeryEscape(item.id)}" onclick="window.editStationeryProduct(this.dataset.productId)" style="padding:6px 8px; font-size:12px;">Edit</button>
                       ${Number(item.quantityOnHand) > 0
                            ? `<button type="button" class="btn-standard btn-dark inventory-row-action" data-product-id="${stationeryEscape(item.id)}" onclick="window.clearStationeryProductStock(this.dataset.productId)" style="padding:6px 8px; font-size:12px;">Clear stock</button>`
                            : '<button type="button" class="btn-standard btn-dark inventory-row-action" disabled title="This item already has zero stock." style="padding:6px 8px; font-size:12px;">Clear stock</button>'}
                       <button type="button" class="btn-standard btn-danger inventory-row-action" data-product-id="${stationeryEscape(item.id)}" onclick="window.deleteStationeryProduct(this.dataset.productId)" style="padding:6px 8px; font-size:12px;">Delete</button>
                   </div>`
                : '—'}</td>
        </tr>`).join('')
        : `<tr><td colspan="6" style="padding:10px; color:#64748b;">${window.stationeryDataLoaded ? 'No active catalog items yet. Add a school supply to begin.' : 'Stationery stock is not available until the independent cloud table is installed and verified.'}</td></tr>`;
}

function renderStationeryMovementHistory() {
    const tbody = document.getElementById('stationeryAdjustmentRows');
    if (!tbody) return;
    const movements = window.stationeryMovements.slice()
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    tbody.innerHTML = movements.length
        ? movements.map(movement => `<tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:7px;">${stationeryEscape(new Date(movement.date).toLocaleString())}</td>
            <td style="padding:7px;">${stationeryEscape(String(movement.type || '').replace(/_/g, ' '))}</td>
            <td style="padding:7px;">${stationeryEscape(stationeryFormatProduct(movement))}</td>
            <td style="padding:7px; text-align:right;">${['PRODUCT_EDITED', 'PRODUCT_ARCHIVED'].includes(movement.type) ? '—' : `${movement.type === 'ISSUED' || movement.type === 'ADJUSTMENT' ? '-' : '+'}${stationeryQuantity(movement.quantity)} ${stationeryEscape(movement.unit)}`}</td>
            <td style="padding:7px;">${stationeryEscape([movement.supplier, movement.note].filter(Boolean).join(' · ') || '—')}</td>
            <td style="padding:7px;">${stationeryEscape(movement.actor || '')}</td>
        </tr>`).join('')
        : '<tr><td colspan="6" style="padding:9px; color:#64748b;">No stationery movements recorded.</td></tr>';
}

window.clearStationeryProductStock = async function(productId) {
    if (!stationeryCanManageCatalog()) return showStationeryStatus('Access denied. Only the Chief Admin can clear stationery stock.', true);
    if (!requireStationeryWriteAccess()) return;
    const product = stationeryFindProduct(productId);
    if (!product || product.active === false) return showStationeryStatus('Active stationery item not found. Reload the section and try again.', true);
    const quantity = Number(product.quantityOnHand);
    if (!Number.isFinite(quantity) || quantity <= 0 || stationeryRound(quantity, 3) !== quantity) {
        return showStationeryStatus('This item has no valid stock to clear.', true);
    }
    const reason = window.prompt(`Why are you clearing ${stationeryQuantity(quantity)} ${product.unit} of ${stationeryFormatProduct(product)}? The stock write-off will be recorded.`);
    if (reason === null) return;
    if (!reason.trim() || reason.trim().length > 300) return showStationeryStatus('A clear-stock reason of 1–300 characters is required.', true);
    if (!window.confirm(`Clear ${stationeryQuantity(quantity)} ${product.unit} from active stationery stock? The adjustment history will be retained.`)) return;
    const movement = {
        id: `STA-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'ADJUSTMENT',
        productId: product.id,
        itemName: product.name,
        category: product.category || '',
        size: product.size || '',
        unit: product.unit,
        quantity: stationeryRound(quantity, 3),
        unitCost: Number(product.averageUnitCost) || 0,
        totalCost: stationeryRound(quantity * (Number(product.averageUnitCost) || 0), 2),
        stockAfter: 0,
        date: new Date().toISOString(),
        note: `Chief Admin cleared ${stationeryQuantity(quantity)} ${product.unit} from active stationery stock. Reason: ${reason.trim()}`,
        actor: stationeryActor(),
        createdAt: new Date().toISOString()
    };
    try {
        await commitStationeryChange(() => {
            product.quantityOnHand = 0;
            window.stationeryMovements.push(movement);
        }, `${product.name} stock was cleared and the write-off was synced. Transaction history was retained.`);
    } catch (error) {
        console.error('Stationery stock clear failed:', error);
    }
};

window.editStationeryProduct = function(productId) {
    if (!stationeryCanManageCatalog()) return showStationeryStatus('Access denied. Only the Chief Admin can edit stationery catalog items.', true);
    if (!requireStationeryWriteAccess()) return;
    const product = stationeryFindProduct(productId);
    if (!product || product.active === false) return showStationeryStatus('Active stationery item not found. Reload the section and try again.', true);
    const hasOpenOrder = window.stationeryOrders.some(order =>
        String(order.productId) === String(product.id) && stationeryOrderRemaining(order) > 0
    );
    const unitLocked = Number(product.quantityOnHand) > 0 || hasOpenOrder;
    document.getElementById('stationeryEditProductId').value = product.id;
    document.getElementById('stationeryEditName').value = product.name || '';
    document.getElementById('stationeryEditCategory').value = product.category || '';
    document.getElementById('stationeryEditSize').value = product.size || '';
    document.getElementById('stationeryEditUnit').value = product.unit || '';
    document.getElementById('stationeryEditUnit').readOnly = unitLocked;
    document.getElementById('stationeryEditUnitHint').textContent = unitLocked
        ? 'The stock unit is locked while stock is on hand or a supplier order is outstanding.'
        : 'You can change the unit because this item has no stock or open orders.';
    document.getElementById('stationeryEditDetails').value = product.details || '';
    document.getElementById('stationeryEditReason').value = '';
    document.getElementById('stationeryEditModal').style.display = 'flex';
};

window.closeStationeryEditModal = function() {
    const modal = document.getElementById('stationeryEditModal');
    if (modal) modal.style.display = 'none';
};

window.saveStationeryProductEdit = async function() {
    if (!stationeryCanManageCatalog()) return showStationeryStatus('Access denied. Only the Chief Admin can edit stationery catalog items.', true);
    if (!requireStationeryWriteAccess()) return;
    const product = stationeryFindProduct(document.getElementById('stationeryEditProductId').value);
    if (!product || product.active === false) return showStationeryStatus('Active stationery item not found. Reload the section before editing.', true);
    const name = document.getElementById('stationeryEditName').value.trim();
    const category = document.getElementById('stationeryEditCategory').value.trim();
    const size = document.getElementById('stationeryEditSize').value.trim();
    const unit = document.getElementById('stationeryEditUnit').value.trim();
    const details = document.getElementById('stationeryEditDetails').value.trim();
    const reason = document.getElementById('stationeryEditReason').value.trim();
    if (!name || !unit) return showStationeryStatus('Item name and stock unit are required.', true);
    if (name.length > 100 || category.length > 60 || size.length > 80 || unit.length > 24 || details.length > 240) {
        return showStationeryStatus('Item name, type, size, unit, or details exceed the allowed length.', true);
    }
    if (!reason || reason.length > 300) return showStationeryStatus('A reason of 1–300 characters is required.', true);
    const hasOpenOrder = window.stationeryOrders.some(order =>
        String(order.productId) === String(product.id) && stationeryOrderRemaining(order) > 0
    );
    if (unit !== product.unit && (Number(product.quantityOnHand) > 0 || hasOpenOrder)) {
        return showStationeryStatus('The stock unit cannot change while this item has stock or an outstanding supplier order.', true);
    }
    const normalize = value => String(value).trim().toLowerCase();
    const duplicate = window.stationeryProducts.find(item => item.active !== false && String(item.id) !== String(product.id) &&
        normalize(item.name) === normalize(name) &&
        normalize(item.category || '') === normalize(category) &&
        normalize(item.size || '') === normalize(size) &&
        normalize(item.unit) === normalize(unit));
    if (duplicate) return showStationeryStatus('Another active item already uses this name, type, size, and unit. Edit that item instead.', true);
    const previous = {
        name: product.name,
        category: product.category || '',
        size: product.size || '',
        unit: product.unit,
        details: product.details || ''
    };
    const next = { name, category, size, unit, details };
    if (Object.keys(next).every(key => previous[key] === next[key])) {
        return showStationeryStatus('No changes were made to this stationery item.', true);
    }
    const movement = {
        id: `STA-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'PRODUCT_EDITED',
        productId: product.id,
        itemName: name,
        category,
        size,
        unit,
        quantity: 0,
        unitCost: Number(product.averageUnitCost) || 0,
        totalCost: 0,
        stockAfter: Number(product.quantityOnHand) || 0,
        previousDetails: previous,
        updatedDetails: next,
        date: new Date().toISOString(),
        note: `Catalog details edited. Previous: ${stationeryFormatProduct({ ...product, ...previous })}; updated: ${stationeryFormatProduct({ ...product, ...next })}. Reason: ${reason}`,
        actor: stationeryActor(),
        createdAt: new Date().toISOString()
    };
    try {
        await commitStationeryChange(() => {
            Object.assign(product, next, {
                lastEditedAt: movement.date,
                lastEditedBy: movement.actor,
                lastEditReason: reason
            });
            window.stationeryMovements.push(movement);
        }, 'Stationery item details were updated and an audit record was added to movement history.');
        window.closeStationeryEditModal();
    } catch (error) {
        console.error('Stationery catalog edit failed:', error);
    }
};

window.deleteStationeryProduct = async function(productId) {
    if (!stationeryCanManageCatalog()) return showStationeryStatus('Access denied. Only the Chief Admin can remove stationery catalog items.', true);
    if (!requireStationeryWriteAccess()) return;
    const product = stationeryFindProduct(productId);
    if (!product || product.active === false) return showStationeryStatus('Active stationery item not found. Reload the section and try again.', true);
    if (Number(product.quantityOnHand) !== 0) {
        return showStationeryStatus('This item still has stock. Use Clear stock first to record a write-off.', true);
    }
    const openOrders = window.stationeryOrders.filter(order =>
        String(order.productId) === String(product.id) && stationeryOrderRemaining(order) > 0
    );
    const outstanding = openOrders.reduce((sum, order) => sum + stationeryOrderRemaining(order), 0);
    const reason = window.prompt(`Why are you removing ${stationeryFormatProduct(product)} from the active catalog? Its order and assignment history will be retained${openOrders.length ? `, and ${stationeryQuantity(outstanding)} outstanding unit(s) will be cancelled` : ''}.`);
    if (reason === null) return;
    if (!reason.trim() || reason.trim().length > 300) return showStationeryStatus('A removal reason of 1–300 characters is required.', true);
    if (!window.confirm(`Remove ${stationeryFormatProduct(product)} from active stationery stock?${openOrders.length ? ` Cancel the ${openOrders.length} outstanding supplier order(s) (${stationeryQuantity(outstanding)} ${product.unit})?` : ''} Received stock and transaction history will be retained.`)) return;
    const now = new Date().toISOString();
    const actor = stationeryActor();
    const movement = {
        id: `STA-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'PRODUCT_ARCHIVED',
        productId: product.id,
        itemName: product.name,
        category: product.category || '',
        size: product.size || '',
        unit: product.unit,
        quantity: 0,
        unitCost: 0,
        totalCost: 0,
        date: now,
        note: `Item removed from active stationery catalog.${openOrders.length ? ` Cancelled ${openOrders.length} open supplier order(s) with ${stationeryQuantity(outstanding)} ${product.unit} outstanding.` : ''} Reason: ${reason.trim()}`,
        actor,
        createdAt: now
    };
    try {
        await commitStationeryChange(() => {
            openOrders.forEach(order => {
                const remaining = stationeryOrderRemaining(order);
                order.status = 'CANCELLED';
                order.cancelledAt = now;
                order.cancelledBy = actor;
                order.cancelledReason = reason.trim();
                order.cancelledRemainingQuantity = remaining;
                order.updatedAt = now;
                order.updatedBy = actor;
            });
            product.active = false;
            product.archivedAt = movement.date;
            product.archivedBy = actor;
            product.archiveReason = reason.trim();
            window.stationeryMovements.push(movement);
        }, `${product.name} was removed from the active catalog. Its transaction history was retained.`);
    } catch (error) {
        console.error('Stationery product removal failed:', error);
    }
};

function renderStationeryOrders() {
    const tbody = document.getElementById('stationeryOrderRows');
    if (!tbody) return;
    const queryTerms = (document.getElementById('stationeryOrderSearch')?.value || '').trim().toLocaleLowerCase()
        .split(/\s+/).filter(term => term && !['the', 'a', 'an', 'of', 'for'].includes(term));
    const orders = window.stationeryOrders.filter(order => {
        const searchable = `${order.itemName} ${order.category} ${order.size} ${order.supplier} ${order.details} ${order.period}`.toLocaleLowerCase();
        return queryTerms.every(term => searchable.includes(term));
    }).slice().sort((a, b) => String(b.orderDate).localeCompare(String(a.orderDate)));
    tbody.innerHTML = orders.length
        ? orders.map(order => `<tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:7px;">${stationeryEscape(order.orderDate)}<br><small>${stationeryEscape(order.period)}</small></td>
            <td style="padding:7px;"><strong>${stationeryEscape(order.itemName)}</strong><br><small>${stationeryEscape(order.category || '')}${order.size ? ` · ${stationeryEscape(order.size)}` : ''}</small></td>
            <td style="padding:7px; text-align:right;">${stationeryQuantity(order.quantityOrdered)} / ${stationeryQuantity(order.quantityReceived || 0)} ${stationeryEscape(order.unit)}<br><small>${stationeryEscape(order.status)}</small></td>
            <td style="padding:7px; text-align:right;">${stationeryMoney(order.unitCost)} / ${stationeryMoney(order.totalCost)}</td>
            <td style="padding:7px;">${stationeryEscape(order.supplier)}${order.details ? `<br><small>${stationeryEscape(order.details)}</small>` : ''}</td>
        </tr>`).join('')
        : `<tr><td colspan="5" style="padding:10px; color:#64748b;">${queryTerms.length ? 'No stationery orders match this supplier or item.' : 'No stationery orders recorded.'}</td></tr>`;
}

function renderStationeryDistributions() {
    const tbody = document.getElementById('stationeryDistributionRows');
    if (!tbody) return;
    const distributions = window.stationeryDistributions.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    tbody.innerHTML = distributions.length
        ? distributions.map(distribution => `<tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:7px;">${stationeryEscape(distribution.date)}<br><small>${stationeryEscape(distribution.period)}</small></td>
            <td style="padding:7px;"><strong>${stationeryEscape(distribution.studentName)}</strong><br><small>${stationeryEscape(distribution.studentId)} · ${stationeryEscape(distribution.grade || 'No grade')}${distribution.isStationeryUser ? '' : ' · exception'}</small></td>
            <td style="padding:7px;">${distribution.lines.map(line => `${stationeryEscape(line.itemName)}: ${stationeryQuantity(line.quantity)} ${stationeryEscape(line.unit)}`).join('<br>')}${distribution.note ? `<br><small>${stationeryEscape(distribution.note)}</small>` : ''}</td>
            <td style="padding:7px; text-align:right;">${stationeryMoney(distribution.totalCost)}</td>
            <td style="padding:7px;">${stationeryEscape(distribution.actor || '')}</td>
        </tr>`).join('')
        : '<tr><td colspan="5" style="padding:10px; color:#64748b;">No stationery assignments recorded.</td></tr>';
}

function stationeryInDateRange(dateValue, start, end) {
    const date = String(dateValue || '').slice(0, 10);
    if (!start && !end) return true;
    if (!stationeryDateValid(date)) return false;
    return (!start || date >= start) && (!end || date <= end);
}

function getStationeryPaymentByStudent(student, start, end) {
    const ledger = Array.isArray(student.ledger) ? student.ledger
        : Array.isArray(student.student_ledger) ? student.student_ledger : [];
    return stationeryRound(ledger.reduce((sum, entry) => {
        if (!entry || ['VOID', 'VOIDED'].includes(String(entry.status || '').toUpperCase())) return sum;
        const type = String(entry.type || '').toLowerCase();
        if (!['payment', 'overpayment'].includes(type)) return sum;
        const description = String(entry.description || entry.desc || entry.notes || '').toLowerCase();
        const method = String(entry.method || entry.payment_method || '').toLowerCase();
        if (entry.is_credit_backed === true || String(entry.is_credit_backed).toLowerCase() === 'true' ||
            method.includes('advance credit') || description.includes('paid via advance credit')) return sum;
        if (!stationeryInDateRange(entry.date, start, end)) return sum;
        const breakdown = Array.isArray(entry.breakdown) ? entry.breakdown : [];
        if (breakdown.length) {
            return sum + breakdown.reduce((parts, allocation) => {
                const label = String(allocation.desc || allocation.description || '').toLowerCase();
                if (!label.includes('stationery')) return parts;
                const amount = Number(allocation.amount ?? allocation.amt);
                return parts + (Number.isFinite(amount) && amount > 0 ? amount : 0);
            }, 0);
        }
        if (!description.includes('stationery')) return sum;
        const amount = Number(entry.amount);
        return sum + (Number.isFinite(amount) && amount > 0 ? amount : 0);
    }, 0), 2);
}

function getStationeryForecast(productId, userCount) {
    const periods = new Map();
    window.stationeryDistributions.forEach(distribution => {
        const lines = Array.isArray(distribution.lines) ? distribution.lines : [];
        const productLines = lines.filter(line => String(line.productId) === String(productId));
        if (!productLines.length) return;
        const period = String(distribution.period || String(distribution.date || '').slice(0, 7));
        if (!period) return;
        if (!periods.has(period)) periods.set(period, { quantity: 0, recipients: new Set(), latestDate: '' });
        const cycle = periods.get(period);
        productLines.forEach(line => { cycle.quantity += Number(line.quantity) || 0; });
        cycle.recipients.add(String(distribution.studentId));
        if (String(distribution.date || '') > cycle.latestDate) cycle.latestDate = String(distribution.date || '');
    });
    const recentRates = [...periods.values()]
        .filter(cycle => cycle.recipients.size > 0)
        .sort((a, b) => b.latestDate.localeCompare(a.latestDate))
        .slice(0, 3)
        .map(cycle => cycle.quantity / cycle.recipients.size);
    if (!recentRates.length || !userCount) return null;
    const averagePerStudent = recentRates.reduce((sum, rate) => sum + rate, 0) / recentRates.length;
    return Math.ceil(averagePerStudent * userCount * 1000) / 1000;
}

window.renderStationeryReport = function() {
    const start = document.getElementById('stationeryReportStart').value;
    const end = document.getElementById('stationeryReportEnd').value;
    if (start && !stationeryDateValid(start)) {
        showStationeryStatus('Select a valid stationery report start date.', true);
        return false;
    }
    if (end && !stationeryDateValid(end)) {
        showStationeryStatus('Select a valid stationery report end date.', true);
        return false;
    }
    if (start && end && start > end) {
        showStationeryStatus('The report start date must be on or before its end date.', true);
        return false;
    }
    const periodLabel = start || end
        ? `Date range: ${start || 'all earlier dates'} to ${end || 'all later dates'}`
        : 'Date range: all recorded dates';
    document.getElementById('stationeryReportPeriod').textContent = `${periodLabel} · Generated ${new Date().toLocaleString()}`;
    if (!window.stationeryDataLoaded) {
        ['stationeryReportOrdered', 'stationeryReportReceived', 'stationeryReportIncome',
            'stationeryReportIssueCost', 'stationeryReportProfit'].forEach(id => {
            document.getElementById(id).textContent = '—';
        });
        document.getElementById('stationeryReportStockRows').innerHTML =
            '<tr><td colspan="9" style="padding:10px; color:#64748b;">Report requires verified stationery ledger data.</td></tr>';
        document.getElementById('stationeryReportStudentRows').innerHTML =
            '<tr><td colspan="5" style="padding:10px; color:#64748b;">Student payment report is not available until data is verified.</td></tr>';
        return false;
    }

    const orderedCost = window.stationeryOrders
        .filter(order => stationeryInDateRange(order.orderDate, start, end))
        .reduce((sum, order) => sum + Number(order.totalCost || 0), 0);
    const receivedCost = window.stationeryMovements
        .filter(movement => movement.type === 'RECEIVED' && stationeryInDateRange(movement.date, start, end))
        .reduce((sum, movement) => sum + Number(movement.totalCost || 0), 0);
    const incomeByStudent = new Map();
    (Array.isArray(window.students) ? window.students : []).forEach(student => {
        const amount = getStationeryPaymentByStudent(student, start, end);
        if (amount > 0) incomeByStudent.set(String(student.id), { student, amount });
    });
    const income = [...incomeByStudent.values()].reduce((sum, item) => sum + item.amount, 0);
    const distributions = window.stationeryDistributions.filter(distribution =>
        stationeryInDateRange(distribution.date, start, end)
    );
    const issuedCost = distributions.reduce((sum, distribution) => sum + Number(distribution.totalCost || 0), 0);
    const profit = stationeryRound(income - issuedCost, 2);
    const users = stationeryActiveStudents().filter(student => student.stationeryUser);
    document.getElementById('stationeryReportOrdered').textContent = stationeryMoney(orderedCost);
    document.getElementById('stationeryReportReceived').textContent = stationeryMoney(receivedCost);
    document.getElementById('stationeryReportIncome').textContent = stationeryMoney(income);
    document.getElementById('stationeryReportIssueCost').textContent = stationeryMoney(issuedCost);
    const profitElement = document.getElementById('stationeryReportProfit');
    profitElement.textContent = `${profit < 0 ? '(' : ''}${stationeryMoney(Math.abs(profit))}${profit < 0 ? ')' : ''}`;
    profitElement.style.color = profit < 0 ? '#b91c1c' : '#15803d';
    document.getElementById('stationeryReportUserCount').textContent = String(users.length);

    const byProduct = new Map();
    const addProduct = product => {
        const id = String(product.id);
        if (!byProduct.has(id)) byProduct.set(id, {
            product, ordered: 0, received: 0, issued: 0, pending: 0
        });
        return byProduct.get(id);
    };
    window.stationeryProducts.forEach(addProduct);
    window.stationeryOrders.forEach(order => {
        const row = byProduct.get(String(order.productId)) || addProduct({
            id: order.productId, name: order.itemName, category: order.category,
            size: order.size, unit: order.unit, quantityOnHand: 0, averageUnitCost: 0
        });
        if (stationeryInDateRange(order.orderDate, start, end)) row.ordered += Number(order.quantityOrdered) || 0;
        row.pending += stationeryOrderRemaining(order);
    });
    window.stationeryMovements.forEach(movement => {
        if (movement.type !== 'RECEIVED' || !stationeryInDateRange(movement.date, start, end)) return;
        const row = byProduct.get(String(movement.productId));
        if (row) row.received += Number(movement.quantity) || 0;
    });
    distributions.forEach(distribution => {
        (Array.isArray(distribution.lines) ? distribution.lines : []).forEach(line => {
            const row = byProduct.get(String(line.productId)) || addProduct({
                id: line.productId, name: line.itemName, category: line.category,
                size: line.size, unit: line.unit, quantityOnHand: 0, averageUnitCost: 0
            });
            row.issued += Number(line.quantity) || 0;
        });
    });

    const stockRows = [...byProduct.values()].sort((a, b) =>
        String(a.product.name).localeCompare(String(b.product.name))
    ).map(({ product, ordered, received, issued, pending }) => {
        const forecast = getStationeryForecast(product.id, users.length);
        const stock = Number(product.quantityOnHand) || 0;
        const shortage = forecast == null ? null : Math.max(0, stationeryRound(forecast - stock - pending, 3));
        const excess = forecast == null ? null : Math.max(0, stationeryRound(stock - forecast, 3));
        const suggestedOrder = shortage;
        return `<tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:7px;"><strong>${stationeryEscape(product.name)}</strong><br><small>${stationeryEscape(product.category || '')}${product.size ? ` · ${stationeryEscape(product.size)}` : ''} · ${stationeryEscape(product.unit || '')}</small></td>
            <td style="padding:7px; text-align:right;">${stationeryQuantity(ordered)} ${stationeryEscape(product.unit || '')}</td>
            <td style="padding:7px; text-align:right;">${stationeryQuantity(received)} ${stationeryEscape(product.unit || '')}</td>
            <td style="padding:7px; text-align:right;">${stationeryQuantity(issued)} ${stationeryEscape(product.unit || '')}</td>
            <td style="padding:7px; text-align:right;">${stationeryQuantity(stock)} ${stationeryEscape(product.unit || '')}</td>
            <td style="padding:7px; text-align:right;">${forecast == null ? 'Needs history' : `${stationeryQuantity(forecast)} ${stationeryEscape(product.unit || '')}`}</td>
            <td style="padding:7px; text-align:right; color:${shortage > 0 ? '#b91c1c' : '#475569'};">${shortage == null ? '—' : `${stationeryQuantity(shortage)} ${stationeryEscape(product.unit || '')}`}</td>
            <td style="padding:7px; text-align:right; color:${excess > 0 ? '#047857' : '#475569'};">${excess == null ? '—' : `${stationeryQuantity(excess)} ${stationeryEscape(product.unit || '')}`}</td>
            <td style="padding:7px; text-align:right; font-weight:700;">${suggestedOrder == null ? 'Needs history' : `${stationeryQuantity(suggestedOrder)} ${stationeryEscape(product.unit || '')}`}</td>
        </tr>`;
    });
    document.getElementById('stationeryReportStockRows').innerHTML = stockRows.length
        ? stockRows.join('')
        : '<tr><td colspan="9" style="padding:10px; color:#64748b;">No stationery products or history match these dates.</td></tr>';

    const studentResults = new Map();
    (Array.isArray(window.students) ? window.students : []).forEach(student => {
        const id = String(student.id);
        const paid = incomeByStudent.get(id)?.amount || 0;
        const studentDistributions = distributions.filter(distribution => String(distribution.studentId) === id);
        const issueCost = studentDistributions.reduce((sum, distribution) => sum + Number(distribution.totalCost || 0), 0);
        if (!paid && !issueCost) return;
        studentResults.set(id, {
            student,
            paid,
            issueCost,
            difference: stationeryRound(paid - issueCost, 2)
        });
    });
    const studentRows = [...studentResults.values()].sort((a, b) =>
        String(a.student.name || '').localeCompare(String(b.student.name || ''))
    ).map(({ student, paid, issueCost, difference }) => `<tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:7px;"><strong>${stationeryEscape(student.name || student.id)}</strong><br><small>${stationeryEscape(student.id)}</small></td>
        <td style="padding:7px;">${stationeryEscape(student.grade || student.class || '')}</td>
        <td style="padding:7px; text-align:right;">${stationeryMoney(paid)}</td>
        <td style="padding:7px; text-align:right;">${stationeryMoney(issueCost)}</td>
        <td style="padding:7px; text-align:right; color:${difference < 0 ? '#b91c1c' : '#15803d'};">${difference < 0 ? '(' : ''}${stationeryMoney(Math.abs(difference))}${difference < 0 ? ')' : ''}</td>
    </tr>`);
    document.getElementById('stationeryReportStudentRows').innerHTML = studentRows.length
        ? studentRows.join('')
        : '<tr><td colspan="5" style="padding:10px; color:#64748b;">No student stationery payments or assignments match these dates.</td></tr>';
    return true;
};

window.renderStationeryModule = function() {
    if (!document.getElementById('stationeryInventoryRows')) return;
    initializeStationerySectionCollapses();
    renderStationerySelectors();
    renderStationeryInventory();
    renderStationeryMovementHistory();
    renderStationeryOrders();
    renderStationeryDistributions();
    renderStationeryAssignmentCart();
    window.updateStationeryOrderEstimate();
    window.updateStationeryAssignEstimate();
    window.renderStationeryReport();
    window.enableInventoryModuleSelectSearch('stationery');
};

window.printStationeryReport = function() {
    if (!window.stationeryDataLoaded) {
        showStationeryStatus('Load current cloud-verified stationery data before printing this report.', true);
        return;
    }
    if (!window.renderStationeryReport()) return;
    const report = document.getElementById('stationeryReport');
    const toggle = report.querySelector('.stationery-section-toggle');
    const wasCollapsed = report.classList.contains('stationery-section-collapsed');
    const method = report.querySelector('.stationery-report-method');
    const wasMethodOpen = method && method.open;
    if (wasCollapsed) {
        report.classList.remove('stationery-section-collapsed');
        if (toggle) {
            toggle.textContent = 'Collapse';
            toggle.setAttribute('aria-expanded', 'true');
        }
    }
    if (method) method.open = true;
    document.body.classList.add('stationery-report-printing');
    let finished = false;
    const finishPrint = () => {
        if (finished) return;
        finished = true;
        window.removeEventListener('afterprint', finishPrint);
        document.body.classList.remove('stationery-report-printing');
        if (wasCollapsed) {
            report.classList.add('stationery-section-collapsed');
            if (toggle) {
                toggle.textContent = 'Expand';
                toggle.setAttribute('aria-expanded', 'false');
            }
        }
        if (method) method.open = wasMethodOpen;
    };
    window.addEventListener('afterprint', finishPrint, { once: true });
    window.print();
    window.setTimeout(finishPrint, 1000);
};

