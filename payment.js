// MoziBang 支付系统

// 创建快速激活函数
function quickActivate(paymentId, method = 'alipay') {
  return PaymentManager.purchasePro({
    verified: true,
    paymentId: paymentId,
    method: method
  });
}

// 使用方法：quickActivate('订单号', '支付方式')

// 订单频率限制管理器
class OrderRateLimiter {
    constructor() {
        this.RATE_LIMIT_KEY = 'lastOrderTime';
        this.RATE_LIMIT_MINUTES = 5;
    }

    // 检查是否可以提交订单
    async canSubmitOrder() {
        try {
            const result = await chrome.storage.local.get([this.RATE_LIMIT_KEY]);
            const lastOrderTime = result[this.RATE_LIMIT_KEY];
            
            if (!lastOrderTime) {
                return { canSubmit: true, remainingTime: 0 };
            }

            const now = Date.now();
            const timeDiff = now - lastOrderTime;
            const limitMs = this.RATE_LIMIT_MINUTES * 60 * 1000;

            if (timeDiff >= limitMs) {
                return { canSubmit: true, remainingTime: 0 };
            } else {
                const remainingMs = limitMs - timeDiff;
                const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));
                return { canSubmit: false, remainingTime: remainingMinutes };
            }
        } catch (error) {
            console.error('检查订单频率限制失败:', error);
            return { canSubmit: true, remainingTime: 0 };
        }
    }

    // 记录订单提交时间
    async recordOrderSubmission() {
        try {
            await chrome.storage.local.set({
                [this.RATE_LIMIT_KEY]: Date.now()
            });
            console.log('订单提交时间已记录');
        } catch (error) {
            console.error('记录订单时间失败:', error);
        }
    }

    // 清除限制记录（用于测试或管理员重置）
    async clearRateLimit() {
        try {
            await chrome.storage.local.remove([this.RATE_LIMIT_KEY]);
            console.log('订单频率限制已清除');
        } catch (error) {
            console.error('清除频率限制失败:', error);
        }
    }
}

// 创建全局实例
window.OrderRateLimiter = new OrderRateLimiter();

const PaymentManager = {
  // 检查个人收款配置是否可用
  hasPersonalPayment() {
    return window.PersonalPaymentConfig && window.PersonalPaymentConfig.enabled;
  },

  // 获取可用的支付方式
  getAvailablePaymentMethods() {
    const methods = [];
    
    // 检查个人收款配置
    if (this.hasPersonalPayment()) {
      const config = window.PersonalPaymentConfig;
      
      if (config.alipay && config.alipay.enabled) {
        methods.push({
          id: 'alipay',
          name: '支付宝',
          icon: config.alipay.qrCodePath,
          type: 'personal_alipay',
          price: config.alipay.amount,
          qrCode: config.alipay.qrCodePath
        });
      }
      
      if (config.wechat && config.wechat.enabled) {
        methods.push({
          id: 'wechat',
          name: '微信支付',
          icon: config.wechat.qrCodePath,
          type: 'personal_wechat', 
          price: config.wechat.amount,
          qrCode: config.wechat.qrCodePath
        });
      }
    }
    
    return methods;
  },

  // 单一价格方案：9.9元Pro版本
  prices: {
    pro: {
      name: 'Pro版本',
      price: 9.9,
      description: '永久有效'
    }
  },

  // 检查Pro状态
  async getProStatus() {
    try {
      const result = await chrome.storage.local.get('proStatus');
      const proData = result.proStatus;
      
      if (!proData || !proData.isPro) {
        return {
          isPro: false,
          plan: 'free',
          message: '免费版本'
        };
      }
      
      return {
        isPro: true,
        plan: proData.plan || 'pro',
        purchaseDate: proData.purchaseDate,
        price: proData.price,
        message: 'Pro版本 (永久有效)'
      };
    } catch (error) {
      console.error('获取Pro状态失败:', error);
      return {
        isPro: false,
        plan: 'free',
        message: '免费版本'
      };
    }
  },

  // 模拟购买Pro版本
  async purchasePro(paymentData = null) {
    // 检查是否提供了有效的支付数据
    if (!paymentData || !paymentData.verified) {
      return {
        success: false,
        message: '需要完成真实支付才能购买Pro版本'
      };
    }

    try {
      const purchaseDate = new Date().toISOString();
      
      const proData = {
        isPro: true,
        plan: 'pro',
        purchaseDate: purchaseDate,
        expiryDate: null, // 永久有效
        price: 9.9,
        paymentId: paymentData.paymentId,
        paymentMethod: paymentData.method
      };
      
      await chrome.storage.local.set({ proStatus: proData });
      
      console.log('Pro版本购买成功: 9.9元');
      return {
        success: true,
        message: '恭喜！您已成功购买Pro版本（9.9元），享受无限制使用！',
        proData: proData
      };
    } catch (error) {
      console.error('购买Pro版本失败:', error);
      return {
        success: false,
        message: `购买失败: ${error.message}`
      };
    }
  },

  // 清除Pro状态
  async clearProStatus() {
    try {
      await chrome.storage.local.remove('proStatus');
      console.log('Pro状态已清除');
      return true;
    } catch (error) {
      console.error('清除Pro状态失败:', error);
      return false;
    }
  },

  // 显示升级对话框
  showUpgradeDialog() {
    console.log('showUpgradeDialog 被调用');
    
    // 检查是否已有弹窗存在
    const existingModal = document.querySelector('.upgrade-modal');
    if (existingModal) {
      console.log('移除已存在的升级弹窗');
      existingModal.remove();
    }
    
    try {
      // 创建升级弹窗
      const upgradeModal = document.createElement('div');
      upgradeModal.className = 'upgrade-modal';
      upgradeModal.innerHTML = `
        <div class="upgrade-content">
          <h3>升级到 MoziBang Pro</h3>
          <p>解锁所有高级功能，享受无限制数据提取和导出！</p>
          
          <div class="pricing-card">
            <h4>Pro版本</h4>
            <div class="price">¥9.9</div>
            <div class="period">永久有效</div>
            <ul>
              <li>✓ 无限制数据提取</li>
              <li>✓ 无限制数据导出</li>
              <li>✓ 批量详情提取</li>
              <li>✓ 永久使用权限</li>
            </ul>
            <button class="upgrade-btn" data-plan="pro">立即购买 ¥9.9</button>
          </div>
          
          <div class="modal-actions">
            <button class="close-btn">取消</button>
          </div>
        </div>
      `;

      // 添加样式
      const style = document.createElement('style');
      style.textContent = `
        .upgrade-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.7);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 10000;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        
        .upgrade-content {
          background: white;
          border-radius: 12px;
          padding: 24px;
          max-width: 400px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          text-align: center;
        }
        
        .upgrade-content h3 {
          margin: 0 0 8px 0;
          color: #1a1a1a;
          font-size: 24px;
          font-weight: 600;
        }
        
        .upgrade-content p {
          margin: 0 0 24px 0;
          color: #666;
          font-size: 16px;
        }
        
        .pricing-card {
          border: 2px solid #4285f4;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
          background: linear-gradient(135deg, #f8f9ff 0%, #e8f0fe 100%);
        }
        
        .pricing-card h4 {
          margin: 0 0 12px 0;
          color: #1a1a1a;
          font-size: 18px;
          font-weight: 600;
        }
        
        .price {
          font-size: 32px;
          font-weight: 700;
          color: #4285f4;
          margin: 12px 0;
        }
        
        .period {
          color: #666;
          font-size: 14px;
          margin-bottom: 16px;
        }
        
        .pricing-card ul {
          list-style: none;
          padding: 0;
          margin: 16px 0;
          text-align: left;
        }
        
        .pricing-card li {
          padding: 6px 0;
          color: #333;
          font-size: 14px;
        }
        
        .upgrade-btn {
          background: #4285f4;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 500;
          width: 100%;
          margin-top: 16px;
        }
        
        .upgrade-btn:hover {
          background: #3367d6;
        }
        
        .modal-actions {
          margin-top: 20px;
        }
        
        .close-btn {
          background: #f1f3f4;
          color: #666;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        }
        
        .close-btn:hover {
          background: #e8eaed;
        }
      `;
      
      // 如果样式还没有添加过，则添加
      if (!document.querySelector('#upgrade-modal-style')) {
        style.id = 'upgrade-modal-style';
        document.head.appendChild(style);
      }

      // 添加事件监听器
      upgradeModal.addEventListener('click', async (e) => {
        if (e.target.classList.contains('upgrade-modal') || e.target.classList.contains('close-btn')) {
          document.body.removeChild(upgradeModal);
        }
        
        if (e.target.classList.contains('upgrade-btn')) {
          await this.handlePurchase(upgradeModal);
        }
      });

      document.body.appendChild(upgradeModal);
      console.log('升级弹窗已创建并添加到页面');
      
    } catch (error) {
      console.error('创建升级弹窗失败:', error);
      alert('无法显示升级界面，请重试');
    }
  },

  // 显示频率限制提示
  showRateLimitDialog(remainingMinutes) {
    const modal = document.createElement('div');
    modal.className = 'rate-limit-modal';
    modal.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content rate-limit-content">
          <div class="rate-limit-icon">⏰</div>
          <h3>订单提交限制</h3>
          <p>为了防止频繁提交，每个账户5分钟内只能提交一次订单。</p>
          <p class="remaining-time">请等待 <strong>${remainingMinutes}</strong> 分钟后再试。</p>
          <div class="modal-buttons">
            <button class="btn-secondary close-rate-limit">我知道了</button>
          </div>
        </div>
      </div>
    `;

    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
      .rate-limit-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10000;
        background-color: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      .rate-limit-content {
        background: white;
        border-radius: 12px;
        max-width: 400px;
        text-align: center;
        padding: 30px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      }
      .rate-limit-icon {
        font-size: 48px;
        margin-bottom: 20px;
      }
      .rate-limit-content h3 {
        margin: 0 0 16px 0;
        color: #1a1a1a;
        font-size: 20px;
        font-weight: 600;
      }
      .rate-limit-content p {
        margin: 0 0 16px 0;
        color: #666;
        font-size: 16px;
        line-height: 1.5;
      }
      .remaining-time {
        color: #ff6b6b !important;
        font-size: 16px !important;
        margin: 15px 0 !important;
      }
      .modal-buttons {
        margin-top: 24px;
      }
      .btn-secondary {
        background: #f1f3f4;
        color: #5f6368;
        border: none;
        padding: 12px 24px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 16px;
        transition: background-color 0.2s;
      }
      .btn-secondary:hover {
        background: #e8eaed;
      }
    `;
    document.head.appendChild(style);

    // 添加事件监听
    modal.querySelector('.close-rate-limit').addEventListener('click', () => {
      modal.remove();
      style.remove();
    });

    modal.querySelector('.modal-overlay').addEventListener('click', (e) => {
      if (e.target === modal.querySelector('.modal-overlay')) {
        modal.remove();
        style.remove();
      }
    });

    document.body.appendChild(modal);
  },

  // 显示个人收款对话框
  async showPersonalPaymentDialog() {
    console.log('showPersonalPaymentDialog 被调用');
    
    // 检查订单频率限制
    const rateLimitCheck = await window.OrderRateLimiter.canSubmitOrder();
    if (!rateLimitCheck.canSubmit) {
      this.showRateLimitDialog(rateLimitCheck.remainingTime);
      return;
    }
    
    // 检查个人收款是否可用
    if (!this.hasPersonalPayment()) {
      console.log('个人收款不可用，回退到原始升级对话框');
      this.showUpgradeDialog();
      return;
    }
    
    // 检查是否已有弹窗存在
    const existingModal = document.querySelector('.personal-payment-modal');
    if (existingModal) {
      console.log('移除已存在的个人收款弹窗');
      existingModal.remove();
    }
    
    try {
      // 获取可用支付方式
      const paymentMethods = this.getAvailablePaymentMethods();
      
      // 创建个人收款弹窗
      const paymentModal = document.createElement('div');
      paymentModal.className = 'personal-payment-modal';
      paymentModal.innerHTML = `
        <div class="payment-content">
          <h3>升级到 MoziBang Pro</h3>
          <p>选择支付方式完成购买，享受无限制使用！</p>
          
          <div class="pricing-info">
            <div class="price">¥9.9</div>
            <div class="period">永久有效</div>
          </div>
          
          <div class="payment-methods">
            ${paymentMethods.map(method => `
              <button class="payment-method-btn" data-method="${method.id}">
                <img src="${method.icon}" alt="${method.name}" class="payment-icon">
                <span>${method.name}</span>
              </button>
            `).join('')}
          </div>
          
          <div class="qr-container" style="display: none;">
            <div class="qr-header">
              <h4 id="qr-title">请使用支付宝扫码付款</h4>
              <div class="amount">¥9.9</div>
            </div>
            <div class="qr-code">
              <img id="qr-image" src="" alt="付款二维码">
            </div>
            <div class="qr-instructions">
              <p>1. 使用手机打开对应支付应用</p>
              <p>2. 扫描上方二维码完成付款</p>
              <p>3. 付款完成后点击下方按钮</p>
            </div>
            <div class="qr-actions">
              <button class="confirm-payment-btn">我已完成付款</button>
              <button class="back-to-methods-btn">返回选择支付方式</button>
            </div>
          </div>
          
          <div class="modal-actions">
            <button class="close-btn">取消</button>
          </div>
        </div>
      `;

      // 添加样式
      const style = document.createElement('style');
      style.textContent = `
        .personal-payment-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.7);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 10000;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        
        .payment-content {
          background: white;
          border-radius: 12px;
          padding: 24px;
          max-width: 420px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          text-align: center;
        }
        
        .payment-content h3 {
          margin: 0 0 8px 0;
          color: #1a1a1a;
          font-size: 24px;
          font-weight: 600;
        }
        
        .payment-content p {
          margin: 0 0 24px 0;
          color: #666;
          font-size: 16px;
        }
        
        .pricing-info {
          margin-bottom: 24px;
        }
        
        .pricing-info .price {
          font-size: 32px;
          font-weight: 700;
          color: #4285f4;
          margin: 12px 0;
        }
        
        .pricing-info .period {
          color: #666;
          font-size: 14px;
        }
        
        .payment-methods {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
          justify-content: center;
        }
        
        .payment-method-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 16px 20px;
          border: 2px solid #e8eaed;
          border-radius: 8px;
          background: white;
          cursor: pointer;
          transition: all 0.2s;
          min-width: 80px;
        }
        
        .payment-method-btn:hover {
          border-color: #4285f4;
          background: #f8f9fa;
        }
        
        .payment-method-btn.selected {
          border-color: #4285f4;
          background: #e8f0fe;
        }
        
        .payment-icon {
          width: 32px;
          height: 32px;
          margin-bottom: 8px;
        }
        
        .payment-method-btn span {
          font-size: 14px;
          color: #333;
        }
        
        .qr-container {
          text-align: center;
        }
        
        .qr-header {
          margin-bottom: 20px;
        }
        
        .qr-header h4 {
          margin: 0 0 8px 0;
          color: #1a1a1a;
          font-size: 18px;
        }
        
        .qr-header .amount {
          font-size: 24px;
          font-weight: 600;
          color: #4285f4;
        }
        
        .qr-code {
          display: flex;
          justify-content: center;
          margin: 20px 0;
        }
        
        .qr-code img {
          width: 200px;
          height: 200px;
          border: 1px solid #e8eaed;
          border-radius: 8px;
        }
        
        .qr-instructions {
          text-align: left;
          margin: 20px 0;
          padding: 16px;
          background: #f8f9fa;
          border-radius: 8px;
        }
        
        .qr-instructions p {
          margin: 8px 0;
          font-size: 14px;
          color: #666;
        }
        
        .qr-actions {
          display: flex;
          gap: 12px;
          margin-top: 20px;
        }
        
        .confirm-payment-btn {
          flex: 1;
          background: #34a853;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 500;
        }
        
        .confirm-payment-btn:hover {
          background: #2d8f47;
        }
        
        .back-to-methods-btn {
          flex: 1;
          background: #f1f3f4;
          color: #666;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        }
        
        .back-to-methods-btn:hover {
          background: #e8eaed;
        }
        
        .modal-actions {
          margin-top: 20px;
        }
        
        .close-btn {
          background: #f1f3f4;
          color: #666;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        }
        
        .close-btn:hover {
          background: #e8eaed;
        }
      `;
      
      // 如果样式还没有添加过，则添加
      if (!document.querySelector('#personal-payment-modal-style')) {
        style.id = 'personal-payment-modal-style';
        document.head.appendChild(style);
      }

      // 添加事件监听器
      paymentModal.addEventListener('click', async (e) => {
        // 关闭弹窗
        if (e.target.classList.contains('personal-payment-modal') || e.target.classList.contains('close-btn')) {
          document.body.removeChild(paymentModal);
          return;
        }
        
        // 选择支付方式 - 修复点击检测逻辑
        const paymentBtn = e.target.closest('.payment-method-btn');
        if (paymentBtn) {
          const method = paymentBtn.dataset.method;
          if (method) {
            this.showQRCode(paymentModal, method);
            return;
          }
        }
        
        // 返回支付方式选择
        if (e.target.classList.contains('back-to-methods-btn')) {
          this.showPaymentMethods(paymentModal);
          return;
        }
        
        // 确认付款
        if (e.target.classList.contains('confirm-payment-btn')) {
          await this.handlePaymentConfirmation(paymentModal);
          return;
        }
      });

      document.body.appendChild(paymentModal);
      console.log('个人收款弹窗已创建并添加到页面');
      
    } catch (error) {
      console.error('创建个人收款弹窗失败:', error);
      alert('无法显示付款界面，请重试');
    }
  },

  // 显示二维码
  showQRCode(modal, method) {
    const methodsContainer = modal.querySelector('.payment-methods');
    const qrContainer = modal.querySelector('.qr-container');
    const qrTitle = modal.querySelector('#qr-title');
    const qrImage = modal.querySelector('#qr-image');
    
    // 隐藏支付方式选择，显示二维码
    methodsContainer.style.display = 'none';
    qrContainer.style.display = 'block';
    
    // 根据支付方式设置二维码
    if (method === 'alipay') {
      qrTitle.textContent = '请使用支付宝扫码付款';
      qrImage.src = 'images/alipay-qr.png';
    } else if (method === 'wechat') {
      qrTitle.textContent = '请使用微信扫码付款';
      qrImage.src = 'images/wechat-qr.png';
    }
    
    console.log(`显示${method}二维码`);
  },

  // 显示支付方式选择
  showPaymentMethods(modal) {
    const methodsContainer = modal.querySelector('.payment-methods');
    const qrContainer = modal.querySelector('.qr-container');
    
    // 显示支付方式选择，隐藏二维码
    methodsContainer.style.display = 'flex';
    qrContainer.style.display = 'none';
    
    console.log('返回支付方式选择');
  },

  // 处理付款确认 - 创建订单并提交到管理系统
  async handlePaymentConfirmation(modal) {
    try {
      // 显示确认处理中
      const confirmBtn = modal.querySelector('.confirm-payment-btn');
      const originalText = confirmBtn.textContent;
      confirmBtn.textContent = '提交订单中...';
      confirmBtn.disabled = true;
      
      // 获取支付方式
      const paymentMethod = modal.querySelector('#qr-title').textContent.includes('支付宝') ? 'alipay' : 'wechat';
      
      // 生成订单ID
      const orderId = 'ORDER_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      
      // 创建订单数据
      const orderData = {
        orderId: orderId,
        amount: 9.9,
        paymentMethod: paymentMethod,
        status: 'pending', // 待确认
        createTime: new Date().toISOString(),
        userInfo: {
          timestamp: Date.now(),
          userAgent: navigator.userAgent
        }
      };
      
      console.log('💾 保存真实订单数据:', orderData);
      
      // 存储订单到本地
      await this.saveOrderToStorage(orderData);
      
      // 记录订单提交时间（用于频率限制）
      await window.OrderRateLimiter.recordOrderSubmission();
      
      // 验证保存是否成功
      const isExtension = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
      if (!isExtension) {
        const savedOrders = JSON.parse(localStorage.getItem('pendingOrders') || '[]');
        console.log('✅ 当前待处理订单数量:', savedOrders.length);
      }
      
      // 关闭支付弹窗
      modal.remove();
      
      // 显示订单提交成功提示
      this.showOrderSubmittedDialog(orderId);
      
    } catch (error) {
      console.error('处理付款确认失败:', error);
      // 恢复按钮状态
      const confirmBtn = modal.querySelector('.confirm-payment-btn');
      if (confirmBtn) {
        confirmBtn.textContent = '我已完成付款';
        confirmBtn.disabled = false;
      }
      alert('订单提交失败，请重试');
    }
  },

  // 保存订单到存储
  async saveOrderToStorage(orderData) {
    try {
      // 环境检测
      const isExtension = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
      
      let existingOrders = [];
      
      if (isExtension) {
        // Chrome扩展环境 - 使用chrome.storage.local
        const result = await chrome.storage.local.get(['pendingOrders']);
        existingOrders = result.pendingOrders || [];
      } else {
        // 网页环境 - 使用localStorage
        const stored = localStorage.getItem('pendingOrders');
        existingOrders = stored ? JSON.parse(stored) : [];
      }
      
      // 添加新订单到数组
      existingOrders.push(orderData);
      
      // 保存回存储
      if (isExtension) {
        await chrome.storage.local.set({ pendingOrders: existingOrders });
      } else {
        localStorage.setItem('pendingOrders', JSON.stringify(existingOrders));
      }
      
      console.log('✅ 订单已保存:', orderData.orderId);
      console.log('📦 当前待处理订单数量:', existingOrders.length);
    } catch (error) {
      console.error('❌ 保存订单失败:', error);
      throw error;
    }
  },

  // 显示订单提交成功对话框
  showOrderSubmittedDialog(orderId) {
    const dialog = document.createElement('div');
    dialog.className = 'order-submitted-modal';
    dialog.innerHTML = `
      <div class="order-submitted-content">
        <h3>✅ 订单已提交</h3>
        <p>您的订单已成功提交，请等待管理员确认。</p>
        <div class="order-info">
          <p><strong>订单号：</strong>${orderId}</p>
          <p><strong>金额：</strong>¥9.9</p>
          <p><strong>状态：</strong>待确认</p>
        </div>
        <p class="notice">管理员确认后，您将自动升级到Pro版本。</p>
        <button class="ok-btn">确定</button>
      </div>
    `;
    
    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
      .order-submitted-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
      }
      .order-submitted-content {
        background: white;
        padding: 24px;
        border-radius: 8px;
        max-width: 400px;
        text-align: center;
      }
      .order-info {
        background: #f8f9fa;
        padding: 16px;
        border-radius: 6px;
        margin: 16px 0;
        text-align: left;
      }
      .notice {
        color: #666;
        font-size: 14px;
        margin: 16px 0;
      }
      .ok-btn {
        background: #4285f4;
        color: white;
        border: none;
        padding: 10px 24px;
        border-radius: 6px;
        cursor: pointer;
      }
    `;
    
    if (!document.querySelector('#order-submitted-style')) {
      style.id = 'order-submitted-style';
      document.head.appendChild(style);
    }
    
    // 添加事件监听
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog || e.target.classList.contains('ok-btn')) {
        dialog.remove();
      }
    });
    
    document.body.appendChild(dialog);
  },

  // 处理购买 - 直接显示个人收款对话框
  async handlePurchase(modal) {
    try {
      // 显示购买处理中
      const buyBtn = modal.querySelector('.upgrade-btn');
      const originalText = buyBtn.textContent;
      buyBtn.textContent = '处理中...';
      buyBtn.disabled = true;
      
      // 关闭当前升级弹窗
      if (modal && modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
      
      // 直接显示个人收款对话框，不检查配置
      await this.showPersonalPaymentDialog();
      
    } catch (error) {
      console.error('处理购买失败:', error);
      alert('购买过程中出现错误，请重试');
    }
  }
};

// 导出给全局使用
if (typeof window !== 'undefined') {
  window.PaymentManager = PaymentManager;
}
