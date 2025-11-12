/**
 * PayFriends Custom Phone Input Component
 * A clean, dark-themed phone number input with country selection
 */

const COUNTRIES = [
  { name: 'Netherlands', code: 'NL', dialCode: '+31', flag: '🇳🇱' },
  { name: 'Spain', code: 'ES', dialCode: '+34', flag: '🇪🇸' },
  { name: 'France', code: 'FR', dialCode: '+33', flag: '🇫🇷' },
  { name: 'Germany', code: 'DE', dialCode: '+49', flag: '🇩🇪' },
  { name: 'United Kingdom', code: 'GB', dialCode: '+44', flag: '🇬🇧' },
  { name: 'Belgium', code: 'BE', dialCode: '+32', flag: '🇧🇪' },
  { name: 'Italy', code: 'IT', dialCode: '+39', flag: '🇮🇹' },
  { name: 'Portugal', code: 'PT', dialCode: '+351', flag: '🇵🇹' },
  { name: 'United States', code: 'US', dialCode: '+1', flag: '🇺🇸' },
  { name: 'Poland', code: 'PL', dialCode: '+48', flag: '🇵🇱' },
  { name: 'Sweden', code: 'SE', dialCode: '+46', flag: '🇸🇪' },
  { name: 'Norway', code: 'NO', dialCode: '+47', flag: '🇳🇴' },
  { name: 'Denmark', code: 'DK', dialCode: '+45', flag: '🇩🇰' },
  { name: 'Austria', code: 'AT', dialCode: '+43', flag: '🇦🇹' },
  { name: 'Switzerland', code: 'CH', dialCode: '+41', flag: '🇨🇭' },
];

class PhoneInput {
  constructor(container) {
    this.container = container;
    this.selectedCountry = COUNTRIES[0]; // Default to Netherlands
    this.elements = {};
    this.isDropdownOpen = false;

    this.init();
  }

  init() {
    // Find or create elements
    this.elements.countryButton = this.container.querySelector('.phone-country-button');
    this.elements.prefix = this.container.querySelector('.phone-prefix');
    this.elements.localInput = this.container.querySelector('.phone-number-input');
    this.elements.fullInput = this.container.querySelector('.phone-number-full');
    this.elements.dropdown = this.container.querySelector('.phone-dropdown');
    this.elements.searchInput = this.container.querySelector('.phone-dropdown-search');
    this.elements.countryList = this.container.querySelector('.phone-country-list');

    // Set up event listeners
    this.setupEventListeners();

    // Initialize with default country
    this.updateCountryDisplay();

    // Parse existing value if present
    const initialValue = this.elements.fullInput.value;
    if (initialValue) {
      this.setNumber(initialValue);
    }
  }

  setupEventListeners() {
    // Country button click - toggle dropdown
    this.elements.countryButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleDropdown();
    });

    // Search input
    this.elements.searchInput.addEventListener('input', (e) => {
      this.filterCountries(e.target.value);
    });

    // Local number input
    this.elements.localInput.addEventListener('input', (e) => {
      this.handleLocalInput(e);
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target) && this.isDropdownOpen) {
        this.closeDropdown();
      }
    });

    // Close dropdown on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isDropdownOpen) {
        this.closeDropdown();
      }
    });

    // Render country list
    this.renderCountryList();
  }

  toggleDropdown() {
    if (this.isDropdownOpen) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }

  openDropdown() {
    this.isDropdownOpen = true;
    this.elements.dropdown.style.display = 'block';
    this.elements.searchInput.value = '';
    this.elements.searchInput.focus();
    this.filterCountries('');
  }

  closeDropdown() {
    this.isDropdownOpen = false;
    this.elements.dropdown.style.display = 'none';
  }

  filterCountries(query) {
    const lowerQuery = query.toLowerCase();
    const filteredCountries = COUNTRIES.filter(country => {
      return country.name.toLowerCase().includes(lowerQuery) ||
             country.code.toLowerCase().includes(lowerQuery) ||
             country.dialCode.includes(lowerQuery);
    });

    this.renderCountryList(filteredCountries);
  }

  renderCountryList(countries = COUNTRIES) {
    this.elements.countryList.innerHTML = countries.map(country => `
      <div class="phone-country-item" data-code="${country.code}">
        <span class="phone-country-flag">${country.flag}</span>
        <span class="phone-country-name">${country.name}</span>
        <span class="phone-country-dial">${country.dialCode}</span>
      </div>
    `).join('');

    // Add click listeners to country items
    this.elements.countryList.querySelectorAll('.phone-country-item').forEach(item => {
      item.addEventListener('click', () => {
        const countryCode = item.dataset.code;
        const country = COUNTRIES.find(c => c.code === countryCode);
        if (country) {
          this.selectCountry(country);
          this.closeDropdown();
          this.elements.localInput.focus();
        }
      });
    });
  }

  selectCountry(country) {
    this.selectedCountry = country;
    this.updateCountryDisplay();
    this.updateFullNumber();
  }

  updateCountryDisplay() {
    // Update button content
    this.elements.countryButton.innerHTML = `
      <span class="phone-country-flag">${this.selectedCountry.flag}</span>
      <span class="phone-country-name">${this.selectedCountry.name}</span>
      <span class="phone-caret">▼</span>
    `;

    // Update prefix
    this.elements.prefix.textContent = this.selectedCountry.dialCode;
  }

  handleLocalInput(e) {
    let value = e.target.value;

    // If user types a +, try to detect country
    if (value.startsWith('+')) {
      this.detectAndSetCountry(value);
      return;
    }

    // Strip non-digits from local input
    const digitsOnly = value.replace(/\D/g, '');
    e.target.value = digitsOnly;

    this.updateFullNumber();
  }

  detectAndSetCountry(fullNumber) {
    // Try to match the dial code
    const sortedCountries = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);

    for (const country of sortedCountries) {
      if (fullNumber.startsWith(country.dialCode)) {
        this.selectedCountry = country;
        this.updateCountryDisplay();

        // Extract local part
        const localPart = fullNumber.substring(country.dialCode.length).replace(/\D/g, '');
        this.elements.localInput.value = localPart;
        this.updateFullNumber();
        return;
      }
    }

    // If no match, just strip non-digits
    const digitsOnly = fullNumber.replace(/\D/g, '');
    this.elements.localInput.value = digitsOnly;
    this.updateFullNumber();
  }

  updateFullNumber() {
    const localDigits = this.elements.localInput.value.replace(/\D/g, '');
    const fullNumber = localDigits ? `${this.selectedCountry.dialCode}${localDigits}` : '';
    this.elements.fullInput.value = fullNumber;
  }

  // Public API methods
  setNumber(e164Number) {
    if (!e164Number || !e164Number.startsWith('+')) {
      return;
    }

    // Try to detect country from dial code
    const sortedCountries = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);

    for (const country of sortedCountries) {
      if (e164Number.startsWith(country.dialCode)) {
        this.selectedCountry = country;
        this.updateCountryDisplay();

        // Extract local part
        const localPart = e164Number.substring(country.dialCode.length).replace(/\D/g, '');
        this.elements.localInput.value = localPart;
        this.updateFullNumber();
        return;
      }
    }
  }

  getNumber() {
    return this.elements.fullInput.value;
  }

  isValidNumber() {
    const number = this.getNumber();
    // Basic validation: must have a dial code and at least one digit
    return number.startsWith('+') && number.length > this.selectedCountry.dialCode.length;
  }

  setInvalid(invalid) {
    if (invalid) {
      this.elements.localInput.classList.add('phone-input-invalid');
    } else {
      this.elements.localInput.classList.remove('phone-input-invalid');
    }
  }
}

// Auto-initialize all phone inputs on the page
const PhoneInputManager = {
  instances: new Map(),

  initialize() {
    document.querySelectorAll('.phone-input-wrapper').forEach(container => {
      const id = container.dataset.phoneId || container.querySelector('.phone-number-full')?.id;
      if (id && !this.instances.has(id)) {
        const instance = new PhoneInput(container);
        this.instances.set(id, instance);
      }
    });
  },

  getInstance(id) {
    return this.instances.get(id);
  }
};

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    PhoneInputManager.initialize();
  });
} else {
  PhoneInputManager.initialize();
}

// Export for use in other scripts
window.PhoneInputManager = PhoneInputManager;
window.PhoneInput = PhoneInput;
