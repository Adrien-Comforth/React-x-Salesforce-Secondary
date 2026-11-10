import { createElement } from 'lwc';
import ProductApp from 'c/productApp';

jest.mock('@salesforce/label/c.Product_App_URL', () => ({ default: 'https://example.vercel.app' }), { virtual: true });

describe('c-product-app', () => {
    afterEach(() => {
        while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
    });

    function render(props = {}) {
        const element = createElement('c-product-app', { is: ProductApp });
        Object.assign(element, props);
        document.body.appendChild(element);
        return element;
    }

    it('frames the label URL in embedded mode', () => {
        const iframe = render().shadowRoot.querySelector('iframe');
        expect(iframe.src).toBe('https://example.vercel.app/?embedded=1');
        expect(iframe.style.height).toBe('720px');
    });

    it('opens the record detail on a record page and honours the appUrl override', () => {
        const iframe = render({ appUrl: 'https://localhost:5173', recordId: '01t000000000001AAA', height: 500 })
            .shadowRoot.querySelector('iframe');
        expect(iframe.src).toBe('https://localhost:5173/?embedded=1#/products/01t000000000001AAA');
        expect(iframe.style.height).toBe('500px');
    });

    it('shows a warning when the URL is invalid', () => {
        const el = render({ appUrl: 'not a url' });
        expect(el.shadowRoot.querySelector('iframe')).toBeNull();
        expect(el.shadowRoot.querySelector('.slds-theme_warning')).not.toBeNull();
    });
});
