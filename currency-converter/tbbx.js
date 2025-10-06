        document.addEventListener('DOMContentLoaded', function () {
            // --- CONFIGURATION ---
            // IMPORTANT: Replace with your actual API key from https://www.exchangerate-api.com/
            // Using a temporary key for demonstration.
            const apiKey = 'a64836b31b7368044b719fa9'; // Replace this!
            const apiUrl = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`;

            // --- DOM ELEMENTS ---
            const fromCurrencySelect = document.getElementById('cc-from-currency');
            const toCurrencySelect = document.getElementById('cc-to-currency');
            const amountInput = document.getElementById('cc-amount');
            const swapButton = document.getElementById('cc-swap-button');
            const resultText = document.getElementById('cc-result-text');
            const resultFinalAmount = document.getElementById('cc-result-final-amount');
            const lastUpdatedSpan = document.getElementById('cc-last-updated');
            const loader = document.getElementById('cc-loader');
            const mainContent = document.getElementById('cc-converter-main');

            // --- STATE ---
            let conversionRates = {};
            let currencyData = {};
            
            // --- API FETCH & INITIALIZATION ---
            async function initializeConverter() {
                showLoader(true);
                try {
                    const data = await fetchCurrencyData();
                    if (data.result === 'error' || !data.conversion_rates) {
                         throw new Error(data['error-type'] || 'Invalid data from API');
                    }
                    conversionRates = data.conversion_rates;
                    currencyData = await fetchCurrencyMetadata();
                    
                    populateCurrencyDropdowns();
                    setInitialValues();
                    setupEventListeners();
                    updateResult();

                    const date = new Date(data.time_last_update_utc);
                    lastUpdatedSpan.textContent = date.toLocaleString();
                    
                    showLoader(false);
                } catch (error) {
                    console.error("Error initializing converter with live data:", error);
                    await initializeWithMockData();
                }
            }

            async function fetchCurrencyData() {
                const cachedData = localStorage.getItem('currencyData');
                const cacheTime = localStorage.getItem('currencyCacheTime');

                // Cache for 6 hours to respect API limits
                if (cachedData && cacheTime && (new Date().getTime() - cacheTime < 6 * 60 * 60 * 1000)) {
                    return JSON.parse(cachedData);
                } else {
                    const response = await fetch(apiUrl);
                    if (!response.ok) {
                        throw new Error(`API request failed with status ${response.status}`);
                    }
                    const data = await response.json();
                    if (data.result === 'error') {
                        throw new Error(`API Error: ${data['error-type']}`);
                    }
                    localStorage.setItem('currencyData', JSON.stringify(data));
                    localStorage.setItem('currencyCacheTime', new Date().getTime());
                    return data;
                }
            }
            
            async function fetchCurrencyMetadata() {
                 // A lightweight way to get currency names without another API call
                 // For a more robust solution, a dedicated currency names API could be used.
                const metadata = {
                    "USD": "US Dollar", "EUR": "Euro", "JPY": "Japanese Yen", "GBP": "British Pound", "AUD": "Australian Dollar",
                    "CAD": "Canadian Dollar", "CHF": "Swiss Franc", "CNY": "Chinese Yuan", "SEK": "Swedish Krona", "NZD": "New Zealand Dollar",
                    "MXN": "Mexican Peso", "SGD": "Singapore Dollar", "HKD": "Hong Kong Dollar", "NOK": "Norwegian Krone", "KRW": "South Korean Won",
                    "TRY": "Turkish Lira", "RUB": "Russian Ruble", "INR": "Indian Rupee", "BRL": "Brazilian Real", "ZAR": "South African Rand",
                    "MYR": "Malaysian Ringgit", "IDR": "Indonesian Rupiah", "THB": "Thai Baht", "PHP": "Philippine Peso", "VND": "Vietnamese Dong",
                    "AED": "UAE Dirham", "ARS": "Argentine Peso", "CLP": "Chilean Peso", "COP": "Colombian Peso", "CZK": "Czech Koruna",
                    "DKK": "Danish Krone", "EGP": "Egyptian Pound", "HUF": "Hungarian Forint", "ILS": "Israeli New Shekel", "ISK": "Icelandic Króna",
                    "KWD": "Kuwaiti Dinar", "NGN": "Nigerian Naira", "PLN": "Polish Złoty", "QAR": "Qatari Riyal", "RON": "Romanian Leu",
                    "SAR": "Saudi Riyal", "UAH": "Ukrainian Hryvnia"
                };
                
                // Add all available currencies from the API response to the metadata if they don't exist
                Object.keys(conversionRates).forEach(code => {
                    if (!metadata[code]) {
                        metadata[code] = code; // Fallback to code if name is not in our list
                    }
                });
                
                return metadata;
            }

            // --- UI FUNCTIONS ---
            function populateCurrencyDropdowns() {
                const currencies = Object.keys(currencyData).sort();
                currencies.forEach(currency => {
                    const optionFrom = document.createElement('option');
                    optionFrom.value = currency;
                    optionFrom.textContent = `${currency} - ${currencyData[currency]}`;
                    fromCurrencySelect.appendChild(optionFrom);

                    const optionTo = document.createElement('option');
                    optionTo.value = currency;
                    optionTo.textContent = `${currency} - ${currencyData[currency]}`;
                    toCurrencySelect.appendChild(optionTo);
                });
            }

            function setInitialValues() {
                // Set defaults, e.g., USD to MYR for Malaysian user context
                fromCurrencySelect.value = 'USD';
                toCurrencySelect.value = 'MYR';
            }

            function updateResult() {
                const amount = parseFloat(amountInput.value);
                const fromCurrency = fromCurrencySelect.value;
                const toCurrency = toCurrencySelect.value;

                if (isNaN(amount) || !conversionRates[fromCurrency] || !conversionRates[toCurrency]) {
                    resultText.textContent = "Please enter a valid amount";
                    resultFinalAmount.textContent = "";
                    return;
                }

                const rateFrom = conversionRates[fromCurrency];
                const rateTo = conversionRates[toCurrency];
                
                // Conversion logic: (amount / rateFrom) * rateTo
                // This converts the amount to the base currency (USD) first, then to the target currency.
                const convertedAmount = (amount / rateFrom) * rateTo;

                const formatter = new Intl.NumberFormat('en-US', {
                    maximumFractionDigits: 2
                });

                resultText.textContent = `${formatter.format(amount)} ${currencyData[fromCurrency]} equals`;
                resultFinalAmount.textContent = `${formatter.format(convertedAmount)} ${currencyData[toCurrency]}`;
                
                updateShareLinks();
            }
            
            function handleSwap() {
                const temp = fromCurrencySelect.value;
                fromCurrencySelect.value = toCurrencySelect.value;
                toCurrencySelect.value = temp;
                updateResult();
            }

            function showLoader(isLoading) {
                loader.style.display = isLoading ? 'block' : 'none';
                mainContent.style.display = isLoading ? 'none' : 'block';
            }

            async function initializeWithMockData() {
                // Display an error message to the user
                const header = document.querySelector('.cc-converter-header');
                const errorMessage = document.createElement('div');
                errorMessage.style.textAlign = 'left';
                errorMessage.style.marginBottom = '1.5rem';
                errorMessage.style.padding = '1rem';
                errorMessage.style.backgroundColor = '#fff3cd';
                errorMessage.style.border = '1px solid #ffeeba';
                errorMessage.style.borderRadius = '8px';
                errorMessage.style.color = '#856404';
                errorMessage.innerHTML = `
                    <p style="margin: 0 0 0.5rem 0; font-weight: bold;">Live Rates Unavailable</p>
                    <p style="margin: 0;">Could not connect to the currency API. This often happens if the API key is missing or invalid. The converter has been loaded with sample data.</p>
                    <p style="margin-top: 0.5rem;">Please replace <strong>'YOUR_API_KEY_HERE'</strong> in the script with a real key from <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener" style="color: #856404; text-decoration: underline;">exchangerate-api.com</a> to get live data.</p>
                `;
                header.parentNode.insertBefore(errorMessage, header.nextSibling);

                // Define mock data
                const mockData = {
                  "time_last_update_utc": new Date().toUTCString(),
                  "conversion_rates": {
                      "USD": 1, "EUR": 0.99, "JPY": 148.6, "GBP": 0.87, "AUD": 1.55, "CAD": 1.36, "CHF": 0.99,
                      "CNY": 7.29, "SEK": 11.0, "NZD": 1.74, "MXN": 19.9, "SGD": 1.41, "HKD": 7.85, "NOK": 10.3,
                      "KRW": 1420, "TRY": 18.6, "RUB": 61.5, "INR": 82.8, "BRL": 5.25, "ZAR": 18.2, "MYR": 4.74,
                      "IDR": 15600, "THB": 38.0, "PHP": 58.8, "VND": 24800, "AED": 3.67, "ARS": 150.5
                  }
                };
                
                conversionRates = mockData.conversion_rates;
                currencyData = await fetchCurrencyMetadata();

                populateCurrencyDropdowns();
                setInitialValues();
                setupEventListeners();
                updateResult();

                lastUpdatedSpan.textContent = new Date(mockData.time_last_update_utc).toLocaleString() + " (Sample Data)";
                
                showLoader(false);
            }

            // --- EVENT LISTENERS ---
            function setupEventListeners() {
                amountInput.addEventListener('input', updateResult);
                amountInput.addEventListener('change', updateResult);
                fromCurrencySelect.addEventListener('change', updateResult);
                toCurrencySelect.addEventListener('change', updateResult);
                swapButton.addEventListener('click', handleSwap);
                
                document.getElementById('cc-copy-link').addEventListener('click', copyLinkToClipboard);
            }
            
            // --- SHARE FUNCTIONALITY ---
            function updateShareLinks() {
                const amount = amountInput.value;
                const from = fromCurrencySelect.value;
                const to = toCurrencySelect.value;
                const result = resultFinalAmount.textContent;
                const text = `I just converted ${amount} ${from} to ${to} and got ${result}! Check out this currency converter:`;
                const url = window.location.href;
                const encodedText = encodeURIComponent(text);
                const encodedUrl = encodeURIComponent(url);

                document.getElementById('cc-share-facebook').href = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`;
                document.getElementById('cc-share-twitter').href = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
                document.getElementById('cc-share-whatsapp').href = `https://api.whatsapp.com/send?text=${encodedText} ${encodedUrl}`;
            }
            
            function copyLinkToClipboard() {
                const copyMessage = document.getElementById('cc-copy-message');
                navigator.clipboard.writeText(window.location.href).then(() => {
                    copyMessage.style.display = 'block';
                    setTimeout(() => {
                        copyMessage.style.display = 'none';
                    }, 2000);
                }).catch(err => {
                    console.error('Failed to copy: ', err);
                });
            }

            // --- INITIALIZE ---
            initializeConverter();
        });
