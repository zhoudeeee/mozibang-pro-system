// MoziBang 统一存储管理器
class MoziBangStorageAdapter {
    constructor() {
        this.storage = localStorage;
        this.prefix = 'mozibang_';
    }
    
    _getKey(key) {
        return this.prefix + key;
    }
    
    async get(key) {
        try {
            const data = this.storage.getItem(this._getKey(key));
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('MoziBang Storage get error:', error);
            return null;
        }
    }
    
    async set(key, value) {
        try {
            this.storage.setItem(this._getKey(key), JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('MoziBang Storage set error:', error);
            return false;
        }
    }
    
    async remove(key) {
        try {
            this.storage.removeItem(this._getKey(key));
            return true;
        } catch (error) {
            console.error('MoziBang Storage remove error:', error);
            return false;
        }
    }
    
    // 生成唯一用户ID
    generateUUID() {
        return 'mozibang-' + 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0,
                v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    
    // 初始化用户ID
    async initializeUser() {
        let userId = await this.get('userId');
        if (!userId) {
            userId = this.generateUUID();
            await this.set('userId', userId);
            await this.set('exportedCount', 0);
            await this.set('isPremium', false);
            console.log('MoziBang User ID generated:', userId);
        }
        return userId;
    }
    
    // 检查导出限制
    async checkExportLimit() {
        const isPremium = await this.get('isPremium') || false;
        const exportedCount = await this.get('exportedCount') || 0;
        
        if (!isPremium && exportedCount >= 100) {
            return {
                canExport: false,
                message: '免费会员最多只能导出100条链接。请升级为高级会员以无限制导出！',
                exportedCount: exportedCount
            };
        }
        
        return {
            canExport: true,
            exportedCount: exportedCount
        };
    }
    
    // 增加导出计数
    async incrementExportCount() {
        const isPremium = await this.get('isPremium') || false;
        if (!isPremium) {
            const currentCount = await this.get('exportedCount') || 0;
            await this.set('exportedCount', currentCount + 1);
        }
    }
    
    // 同步用户状态
    async syncUserStatus(backendUrl) {
        try {
            const userId = await this.get('userId');
            if (!userId) return false;
            
            const response = await fetch(`${backendUrl}/api/user/status?userId=${userId}`);
            const data = await response.json();
            
            if (data && typeof data.isPremium === 'boolean') {
                await this.set('isPremium', data.isPremium);
                if (data.isPremium) {
                    await this.set('exportedCount', 0); // 重置计数
                }
                console.log('Premium status updated:', data.isPremium);
                return data.isPremium;
            }
        } catch (error) {
            console.error('Error syncing user status:', error);
        }
        return false;
    }
    
    // 获取用户ID
    getUserId() {
        try {
            return localStorage.getItem(this._getKey('userId'));
        } catch (error) {
            console.error('Error getting user ID:', error);
            return null;
        }
    }
    
    // 设置用户ID
    setUserId(userId) {
        try {
            localStorage.setItem(this._getKey('userId'), userId);
            return true;
        } catch (error) {
            console.error('Error setting user ID:', error);
            return false;
        }
    }
}

// 全局存储实例
window.moziBangStorage = new MoziBangStorageAdapter();