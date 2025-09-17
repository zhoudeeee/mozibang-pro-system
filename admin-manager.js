// MoziBang 管理后台 - 订单管理器

// 存储适配器类
class StorageAdapter {
    constructor() {
        this.isExtension = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
    }
    
    async get(keys) {
        if (this.isExtension) {
            return await chrome.storage.local.get(keys);
        } else {
            // 网页环境读取localStorage - 修复版
            const result = {};
            keys.forEach(key => {
                const value = localStorage.getItem(key);
                if (value) {
                    try {
                        result[key] = JSON.parse(value);
                    } catch (e) {
                        console.error(`解析${key}数据失败:`, e);
                        result[key] = null;
                    }
                } else {
                    // 关键修复：即使没有数据也要设置key
                    result[key] = null;
                }
            });
            return result;
        }
    }

    async set(items) {
        if (this.isExtension) {
            return await chrome.storage.local.set(items);
        } else {
            Object.keys(items).forEach(key => {
                localStorage.setItem(key, JSON.stringify(items[key]));
            });
        }
    }
}

const storage = new StorageAdapter();

// 加载订单 - 统一版本
async function loadOrders() {
    try {
        console.log('🔄 开始加载订单...');
        
        const result = await storage.get(['pendingOrders']);
        const orders = result.pendingOrders || [];
        
        console.log('📦 加载到订单:', orders.length, '个');
        console.log('📋 订单详情:', orders);
        
        displayOrders(orders);
        
        // 更新页面标题显示订单数量
        document.title = `MoziBang 订单管理 (${orders.length}个待处理)`;
        
    } catch (error) {
        console.error('❌ 加载订单失败:', error);
        showErrorState(error.message);
    }
}

// 显示订单列表 - 美化版
function displayOrders(orders) {
    const ordersList = document.getElementById('orders-list');
    
    if (orders.length === 0) {
        ordersList.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 48px; margin-bottom: 16px;">📋</div>
                <h3>暂无待确认订单</h3>
                <p>当用户完成支付后，订单将在这里显示</p>
                <button onclick="loadOrders()" class="refresh-btn">🔄 刷新检查</button>
            </div>
        `;
        return;
    }
    
    ordersList.innerHTML = orders.map((order, index) => `
        <div class="order-item animate-in" style="animation-delay: ${index * 0.1}s" data-order-id="${order.orderId}">
            <div class="order-info">
                <div class="order-id">📄 ${order.orderId}</div>
                <div class="order-details">
                    💰 金额: <strong>¥${order.amount}</strong> | 
                    💳 ${order.paymentMethod === 'alipay' ? '支付宝' : '微信支付'} | 
                    🕐 ${new Date(order.createTime).toLocaleString()}
                </div>
            </div>
            <div class="order-actions">
                <span class="status status-${order.status}">
                    ${order.status === 'pending' ? '⏳ 待确认' : '✅ 已确认'}
                </span>
                ${order.status === 'pending' ? `
                    <button class="confirm-btn" onclick="confirmOrder('${order.orderId}')">
                        ✅ 确认升级
                    </button>
                    <button class="reject-btn" onclick="rejectOrder('${order.orderId}')">
                        ❌ 拒绝
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

// 错误状态显示
function showErrorState(errorMessage) {
    const ordersList = document.getElementById('orders-list');
    ordersList.innerHTML = `
        <div class="error-state">
            <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
            <h3>订单加载失败</h3>
            <p>错误信息: ${errorMessage}</p>
            <div style="margin-top: 16px;">
                <button onclick="loadOrders()" class="refresh-btn">🔄 重新加载</button>
                <button onclick="clearStorage()" class="clear-btn" style="margin-left: 8px; background: #ff9800;">🗑️ 清除缓存</button>
            </div>
        </div>
    `;
}

// 清除存储缓存
async function clearStorage() {
    if (confirm('确定要清除所有订单缓存吗？这将删除所有待处理订单！')) {
        try {
            await storage.set({ pendingOrders: [], orderHistory: [] });
            alert('✅ 缓存已清除');
            loadOrders();
        } catch (error) {
            alert('❌ 清除失败: ' + error.message);
        }
    }
}

// 确认订单 - 增强版
async function confirmOrder(orderId) {
    try {
        if (!confirm(`🎉 确定要确认订单 ${orderId} 并将用户升级到Pro版本吗？`)) return;
        
        // 显示处理中状态
        const orderItem = document.querySelector(`[data-order-id="${orderId}"]`);
        if (orderItem) {
            orderItem.style.opacity = '0.6';
            orderItem.innerHTML += '<div class="processing">⏳ 处理中...</div>';
        }
        
        const result = await storage.get(['pendingOrders']);
        const orders = result.pendingOrders || [];
        
        const orderIndex = orders.findIndex(order => order.orderId === orderId);
        if (orderIndex === -1) {
            alert('❌ 订单不存在');
            return;
        }
        
        // 更新订单状态
        orders[orderIndex].status = 'confirmed';
        orders[orderIndex].confirmTime = new Date().toISOString();
        orders[orderIndex].adminAction = 'confirmed';
        
        // 激活Pro状态
        await activateUserPro(orderId);
        
        // 移动到历史记录
        await saveToOrderHistory(orders[orderIndex]);
        
        // 从待处理列表移除
        const pendingOrders = orders.filter(order => order.orderId !== orderId);
        await storage.set({ pendingOrders: pendingOrders });
        
        // 成功提示
        alert(`🎉 订单 ${orderId} 已确认！\n用户已成功升级到Pro版本！`);
        
        // 重新加载
        loadOrders();
        
    } catch (error) {
        console.error('确认订单失败:', error);
        alert('❌ 确认订单失败: ' + error.message);
        loadOrders(); // 恢复界面
    }
}

// 激活Pro状态 - 修复版
async function activateUserPro(orderId) {
    const proStatus = {
        isPro: true,
        activatedAt: new Date().toISOString(),
        orderId: orderId,
        method: 'admin_confirmed',
        adminConfirmTime: new Date().toISOString()
    };
    
    // 保存到当前环境（localStorage或chrome.storage.local）
    await storage.set({ proStatus: proStatus });
    
    // 如果在扩展环境中，同时保存到chrome.storage.local
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        try {
            await chrome.storage.local.set({ proStatus: proStatus });
            console.log('✅ Pro状态已同步到chrome.storage.local');
        } catch (error) {
            console.error('❌ 同步到chrome.storage.local失败:', error);
        }
    }
    
    console.log('✅ 用户Pro状态已激活:', orderId);
}

// 保存订单历史
async function saveToOrderHistory(order) {
    try {
        const result = await storage.get(['orderHistory']);
        const history = result.orderHistory || [];
        
        history.unshift(order); // 最新的在前面
        
        // 只保留最近100条记录
        if (history.length > 100) {
            history.splice(100);
        }
        
        await storage.set({ orderHistory: history });
        console.log('📝 订单已保存到历史记录');
    } catch (error) {
        console.error('保存历史记录失败:', error);
    }
}

// 拒绝订单
async function rejectOrder(orderId) {
    try {
        if (!confirm(`❌ 确定要拒绝订单 ${orderId} 吗？\n此操作不可撤销！`)) return;
        
        const result = await storage.get(['pendingOrders']);
        const orders = result.pendingOrders || [];
        
        // 找到订单并标记为拒绝
        const order = orders.find(o => o.orderId === orderId);
        if (order) {
            order.status = 'rejected';
            order.rejectTime = new Date().toISOString();
            order.adminAction = 'rejected';
            
            // 保存到历史记录
            await saveToOrderHistory(order);
        }
        
        // 从待处理列表移除
        const updatedOrders = orders.filter(order => order.orderId !== orderId);
        await storage.set({ pendingOrders: updatedOrders });
        
        alert(`✅ 订单 ${orderId} 已拒绝`);
        loadOrders();
        
    } catch (error) {
        console.error('拒绝订单失败:', error);
        alert('❌ 拒绝订单失败: ' + error.message);
    }
}

// 自动刷新功能
let autoRefreshInterval;

function startAutoRefresh() {
    stopAutoRefresh();
    autoRefreshInterval = setInterval(() => {
        console.log('🔄 自动刷新订单...');
        loadOrders();
    }, 30000); // 30秒刷新一次
    
    console.log('✅ 自动刷新已启动 (30秒间隔)');
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        console.log('⏹️ 自动刷新已停止');
    }
}

// 导出全局函数
if (typeof window !== 'undefined') {
    window.loadOrders = loadOrders;
    window.confirmOrder = confirmOrder;
    window.rejectOrder = rejectOrder;
    window.clearStorage = clearStorage;
    window.startAutoRefresh = startAutoRefresh;
    window.stopAutoRefresh = stopAutoRefresh;
}

// 页面加载完成后自动启动
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 MoziBang 订单管理系统启动');
    loadOrders();
    startAutoRefresh();
});