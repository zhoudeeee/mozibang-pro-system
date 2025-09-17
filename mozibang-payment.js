// MoziBang 支付处理系统
class MoziBangPayment {
    constructor() {
        this.storage = window.moziBangStorage;
        this.backendUrl = 'https://zhoudeeee.github.io/mozibang-pro-system/'; // 更新为正确的后端地址
    }
    
    // 显示升级页面
    async showUpgradePage() {
        const userId = await this.storage.get('userId');
        const exportedCount = await this.storage.get('exportedCount') || 0;
        
        const upgradeHtml = `
            <div class="mozibang-upgrade-container">
                <h2>升级为MoziBang Pro会员</h2>
                <div class="user-info">
                    <p><strong>您的用户ID：</strong> <span id="user-id">${userId}</span></p>
                    <p><strong>已导出：</strong> ${exportedCount}/100 条链接</p>
                </div>
                
                <div class="upgrade-benefits">
                    <h3>Pro会员特权：</h3>
                    <ul>
                        <li>✅ 无限制导出链接</li>
                        <li>✅ 高级筛选功能</li>
                        <li>✅ 批量操作工具</li>
                        <li>✅ 优先技术支持</li>
                    </ul>
                </div>
                
                <div class="payment-section">
                    <h3>支付方式 - ¥19.9/永久</h3>
                    <div class="payment-methods">
                        <div class="payment-method">
                            <h4>微信支付</h4>
                            <img src="https://mozibang.com/mozibang/images/wechat-qr.png" alt="微信收款码" class="qr-code">
                            <p class="payment-note">请在支付时备注您的用户ID：<strong>${userId}</strong></p>
                        </div>
                        <div class="payment-method">
                            <h4>支付宝</h4>
                            <img src="https://mozibang.com/mozibang/images/alipay-qr.png" alt="支付宝收款码" class="qr-code">
                            <p class="payment-note">请在支付时备注您的用户ID：<strong>${userId}</strong></p>
                        </div>
                    </div>
                </div>
                
                <div class="order-submit">
                    <h3>支付完成后，请提交订单信息：</h3>
                    <form id="order-form">
                        <div class="form-group">
                            <label>支付方式：</label>
                            <select id="payment-method" required>
                                <option value="">请选择</option>
                                <option value="wechat">微信支付</option>
                                <option value="alipay">支付宝</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>交易号：</label>
                            <input type="text" id="transaction-id" placeholder="请输入支付交易号" required>
                        </div>
                        <div class="form-group">
                            <label>支付截图：</label>
                            <input type="file" id="payment-screenshot" accept="image/*" required>
                        </div>
                        <div class="form-group">
                            <label>备注：</label>
                            <textarea id="order-notes" placeholder="其他说明（可选）"></textarea>
                        </div>
                        <button type="submit" class="submit-order-btn">提交订单</button>
                    </form>
                </div>
                
                <div class="order-status">
                    <button id="check-status-btn" class="check-status-btn">查询订单状态</button>
                    <button id="sync-status-btn" class="sync-status-btn">刷新会员状态</button>
                </div>
            </div>
        `;
        
        return upgradeHtml;
    }
    
    // 提交订单
    async submitOrder(orderData) {
        try {
            const userId = await this.storage.get('userId');
            const formData = new FormData();
            
            formData.append('userId', userId);
            formData.append('paymentMethod', orderData.paymentMethod);
            formData.append('transactionId', orderData.transactionId);
            formData.append('notes', orderData.notes || '');
            formData.append('amount', '19.9');
            
            if (orderData.screenshot) {
                formData.append('screenshot', orderData.screenshot);
            }
            
            // 调用后端API接口
            const response = await fetch(`${this.backendUrl}/api/orders/submit`, {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                // 保存订单ID到本地
                await this.storage.set('lastOrderId', result.orderId);
                return {
                    success: true,
                    message: '订单提交成功！我们将在24小时内处理您的订单。',
                    orderId: result.orderId
                };
            } else {
                return {
                    success: false,
                    message: result.message || '订单提交失败，请重试。'
                };
            }
        } catch (error) {
            console.error('Submit order error:', error);
            return {
                success: false,
                message: '网络错误，请检查网络连接后重试。'
            };
        }
    }
    
    // 查询订单状态
    async checkOrderStatus() {
        try {
            const userId = await this.storage.get('userId');
            const response = await fetch(`${this.backendUrl}/api/orders/status?userId=${userId}`);
            const data = await response.json();
            
            return data;
        } catch (error) {
            console.error('Check order status error:', error);
            return { error: '查询失败，请重试。' };
        }
    }
    
    // 同步会员状态
    async syncPremiumStatus() {
        return await this.storage.syncUserStatus(this.backendUrl);
    }
}

// 全局支付实例
window.moziBangPayment = new MoziBangPayment();

// 支付成功后跳转
function redirectToSuccess(orderId) {
    // 更新跳转URL
    window.location.href = `mozibang-payment-success.html?orderId=${orderId}`;

}
