        // DOM Elements
        const companyCards = document.querySelectorAll('.company-card[data-company]');
        const selectedCompanyDiv = document.getElementById('selected-company');
        const selectedCompanyName = document.getElementById('selected-company-name');
        const fonamexOptions = document.getElementById('fonamex-options');
        const weekInput = document.getElementById('week-input');
        const weekNumber = document.getElementById('week-number');
        const dropZone = document.getElementById('drop-zone');
        const xmlFilesInput = document.getElementById('xml-files');
        const browsebton = document.getElementById('browse-bton');
        const fileInfo = document.getElementById('file-info');
        const fileCount = document.getElementById('file-count');
        const fileList = document.getElementById('file-list');
        const processingSection = document.getElementById('processing-section');
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        const logContainer = document.getElementById('log-container');
        const resultsSection = document.getElementById('results-section');
        const totalFiles = document.getElementById('total-files');
        const processedFiles = document.getElementById('processed-files');
        const errorFiles = document.getElementById('error-files');
        const employeesProcessed = document.getElementById('employees-processed');
        const summaryBody = document.getElementById('summary-body');
        const downloadbton = document.getElementById('download-bton');
        const newProcessbton = document.getElementById('new-process-bton');
        const errorModal = document.getElementById('error-modal');
        const closeErrorModal = document.getElementById('close-error-modal');
        const errorList = document.getElementById('error-list');
        const employeeModal = document.getElementById('employee-modal');
        const closeEmployeeModal = document.getElementById('close-employee-modal');
        const employeeList = document.getElementById('employee-list');
        const errorCard = document.getElementById('error-card');
        const employeeCard = document.getElementById('employee-card');

        // Al iniciar
        dropZone.classList.add('disabled');

        // App State
        let selectedCompany = null;
        let uploadedFiles = [];
        let processingData = {
            totalFiles: 0,
            processed: 0,
            errors: 0,
            employees: 0
        };
        let processedXMLData = [];
        let finalData = [];
        let errorDetails = [];
        let employeeDetails = [];
        let stateSummary = [];
        let xmlDates = []; // Para almacenar las fechas de los XML

        // Catálogo JSON de conceptos de nómina
        let nomCatalog = null;                    // Contenido de /json/nom.json
        let companyConceptConfig = null;          // Sección de la empresa seleccionada
        let conceptUsage = {                      // Conceptos realmente encontrados en los XML
            percepciones: {},                    // { claveCanonica: 'Nombre para mostrar' }
            deducciones: {}
        };
        let selectedConcepts = {                  // Conceptos que el usuario quiere incluir en Excel
            percepciones: {},                    // se llenan al construir los checkboxes
            deducciones: {}
        };

        // Namespaces
        const ns = {
            cfdi: "http://www.sat.gob.mx/cfd/4",
            nom: "http://www.sat.gob.mx/nomina12",
            tfd: "http://www.sat.gob.mx/TimbreFiscalDigital"
        };

        // Mapeo para validar que los XML correspondan a la empresa seleccionada
        const companyValidationConfig = {
            'Fonamex': {
                rfc: 'FON940825TH4'
                // nameIncludes opcional si algún día lo quieres usar
                // nameIncludes: 'FONAMEX'
            },
            'Pronamex': {
                rfc: 'PNA911206PM8'
                // nameIncludes: 'PROMOTORA NACIONAL AGROPECUARIA MEXICANA'
            },
            'CUAN': {
                rfc: 'CUA190625SE3'
                // nameIncludes: 'CENTRO UNIVERSITARIO PARA ADMINISTRACION DE NEGOCIOS'
            },
            'Felicrece': {
                rfc: 'IFE130909QE9'
                // nameIncludes: 'INMOBILIARIA FELI-CRECE'
            }
        };

        // -------------------------------
        // Funciones de utilidad UI / logging
        // -------------------------------
        function addLog(message, type = 'info') {
            const logEntry = document.createElement('div');
            logEntry.className = `log-entry ${type}`;
            logEntry.textContent = message;
            logContainer.appendChild(logEntry);
            logContainer.scrollTop = logContainer.scrollHeight;
        }

        function resetUI() {
            dropZone.classList.add('disabled');
            fileInfo.style.display = 'none';
            processingSection.style.display = 'none';
            resultsSection.style.display = 'none';
            errorModal.style.display = 'none';
            employeeModal.style.display = 'none';
            logContainer.innerHTML = '';
            summaryBody.innerHTML = '';
            employeesProcessed.textContent = '0';
            errorFiles.textContent = '0';
            processedFiles.textContent = '0';
            totalFiles.textContent = '0';
            progressFill.style.width = '0%';
            progressText.textContent = '0%';
            progressFill.querySelector('.progress-text').textContent = '0%';
            errorCard.style.display = 'none';
            employeeCard.style.display = 'none';
            // 🔄 Limpiar el card de "Conceptos detectados"
            const conceptSelection = document.getElementById('concept-selection');
            if (conceptSelection) {
                conceptSelection.remove();
            }
        }

        // -------------------------------
        // Manejo de catálogo JSON (nom.json)
        // -------------------------------
        async function ensureNomCatalogLoaded() {
            if (nomCatalog) return;

            try {
                // 1️⃣ Intento desde el mismo sitio
                let response = await fetch('/json/nom.json', { cache: 'no-cache' });

                if (!response.ok) {
                    // 2️⃣ Intento desde dominio absoluto
                    addLog('Intentando cargar catálogo desde el dominio principal...', 'warning');

                    response = await fetch('https://pronamex.github.io/ProcesadorNominas/nom.json', { cache: 'no-cache' });
                    if (!response.ok) {
                        throw new Error('No se pudo cargar el catálogo desde ninguna ubicación.');
                        alert("No se pudo cargar el catálogo desde ninguna ubicación");
                    }
                }

                nomCatalog = await response.json();
                addLog('Catálogo de conceptos cargado correctamente (nom.json).', 'success', 'ver: 1.3 20/02/26');
                alert("Catalogo de conceptos cargado correctamente.");

            } catch (err) {
                addLog('Error cargando catálogo de conceptos: ' + err.message, 'error');
                alert('Error cargando catálogo de conceptos, favor de reportar al área de sistemas.');
            }
        }


        function normalizeConceptString(value) {
            return (value || '').toString().trim().toUpperCase();
        }

        // Devuelve la clave canónica del concepto (llave del JSON) o null
        function matchConceptFromCatalog(section, clave, concepto) {
            if (!companyConceptConfig || !companyConceptConfig[section]) return null;
            const catalogSection = companyConceptConfig[section];
            const codeNorm = normalizeConceptString(clave);
            const nameNorm = normalizeConceptString(concepto);

            // 1) Buscar por código (comparando la clave del JSON con el atributo Clave del XML)
            for (const [canonicalKey, arr] of Object.entries(catalogSection)) {
                if (normalizeConceptString(canonicalKey) === codeNorm && codeNorm !== '') {
                    return canonicalKey;
                }
            }

            // 2) Si no se encontró por código, buscar por nombre en todos los elementos del arreglo
            for (const [canonicalKey, arr] of Object.entries(catalogSection)) {
                if (Array.isArray(arr) && arr.length > 0) {
                    if (arr.some(n => normalizeConceptString(n) === nameNorm && nameNorm !== '')) {
                        return canonicalKey;
                    }
                }
            }
            return null;
        }

        // Devuelve { canonicalKey, config } del concepto en el catálogo, o null
        function findConceptInCatalog(section, clave, concepto) {
            if (!companyConceptConfig || !companyConceptConfig[section]) return null;
            const catalogSection = companyConceptConfig[section];
            const codeNorm = normalizeConceptString(clave);
            const nameNorm = normalizeConceptString(concepto);

            // 1) Buscar por código (clave del XML)
            for (const [canonicalKey, config] of Object.entries(catalogSection)) {
                if (normalizeConceptString(canonicalKey) === codeNorm && codeNorm !== '') {
                    return { canonicalKey, config };
                }
            }

            // 2) Buscar por nombre (dentro de 'nombre(s)' o el array de nombres)
            for (const [canonicalKey, config] of Object.entries(catalogSection)) {
                let nombres = [];
                if (Array.isArray(config)) {
                    nombres = config;
                } else if (config && typeof config === 'object' && config['nombre(s)']) {
                    nombres = config['nombre(s)'];
                }
                if (Array.isArray(nombres) && nombres.some(n => normalizeConceptString(n) === nameNorm && nameNorm !== '')) {
                    return { canonicalKey, config };
                }
            }
            return null;
        }

        // Devuelve el nombre "bonito" para mostrar en UI/Excel
        function getConceptDisplayName(section, canonicalKey, tipo = null) {
            if (!companyConceptConfig || !companyConceptConfig[section]) {
                return tipo ? `${canonicalKey} ${tipo}` : canonicalKey;
            }
            const config = companyConceptConfig[section][canonicalKey];
            let baseName = canonicalKey;
            if (Array.isArray(config) && config.length > 0) {
                baseName = config[0];
            } else if (config && typeof config === 'object' && config['nombre(s)'] && config['nombre(s)'].length > 0) {
                baseName = config['nombre(s)'][0];
            }
            if (tipo) {
                let suffix = '';
                if (tipo === 'ImporteGravado') suffix = 'Grav';
                else if (tipo === 'ImporteExento') suffix = 'Ex';
                else suffix = tipo;
                return `${baseName} ${suffix}`;
            }
            return baseName;
        }

        // -------------------------------
        // UI para selección de conceptos
        // -------------------------------
        function ensureConceptSelectionContainer() {
            let container = document.getElementById('concept-selection');
            if (!container) {
                container = document.createElement('div');
                container.id = 'concept-selection';
                container.className = 'app-card';
                container.style.marginTop = '25px';
                container.innerHTML = `
                    <h3 style="margin-bottom:10px;color:var(--primary);">Conceptos detectados</h3>
                    <p style="margin-bottom:15px;font-size:0.9rem;">
                        Selecciona las percepciones y deducciones que quieres incluir como columnas adicionales en el Excel.
                    </p>
                    <div class="concept-groups" style="display:flex;gap:30px;flex-wrap:wrap;">
                        <div class="concept-group" style="flex:1;min-width:220px;">
                            <h4>Percepciones</h4>
                            <div id="percepciones-checkboxes" class="checkbox-list"></div>
                        </div>
                        <div class="concept-group" style="flex:1;min-width:220px;">
                            <h4>Deducciones</h4>
                            <div id="deducciones-checkboxes" class="checkbox-list"></div>
                        </div>
                    </div>
                `;

                // Insertar el card justo después de la sección de procesamiento
                if (processingSection && processingSection.parentNode) {
                    processingSection.parentNode.insertBefore(container, processingSection.nextSibling);
                } else {
                    document.body.appendChild(container);
                }

                // Manejar cambios de checkboxes (delegación)
                container.addEventListener('change', (e) => {
                    if (e.target && e.target.matches('input[type="checkbox"][data-type][data-key]')) {
                        const type = e.target.getAttribute('data-type'); // percepciones / deducciones
                        const key = e.target.getAttribute('data-key');
                        if (type === 'percepciones' || type === 'deducciones') {
                            if (e.target.checked) {
                                selectedConcepts[type][key] = true;
                            } else {
                                selectedConcepts[type][key] = false;
                            }
                        }
                    }
                });
            }
            return container;
        }

        function buildConceptCheckboxes() {
            if (!companyConceptConfig) {
                return;
            }

            const container = ensureConceptSelectionContainer();
            container.style.display = 'block';

            const perDiv = document.getElementById('percepciones-checkboxes');
            const dedDiv = document.getElementById('deducciones-checkboxes');

            if (!perDiv || !dedDiv) return;

            perDiv.innerHTML = '';
            dedDiv.innerHTML = '';

            const perEntries = Object.entries(conceptUsage.percepciones || {});
            const dedEntries = Object.entries(conceptUsage.deducciones || {});

            if (perEntries.length === 0 && dedEntries.length === 0) {
                container.style.display = 'none';
                return;
            }

            // Construir checkboxes de percepciones
            perEntries
                .sort((a, b) => a[1].localeCompare(b[1], 'es-MX'))
                .forEach(([canonicalKey, label]) => {
                    const checkboxId = `per-${canonicalKey}`;
                    const wrapper = document.createElement('label');
                    wrapper.className = 'checkbox-item';
                    wrapper.style.display = 'block';
                    wrapper.style.marginBottom = '4px';
                    wrapper.innerHTML = `
                        <input type="checkbox" id="${checkboxId}"
                               data-type="percepciones"
                               data-key="${canonicalKey}"
                               checked />
                        <span>${label}</span>
                    `;
                    perDiv.appendChild(wrapper);
                    selectedConcepts.percepciones[canonicalKey] = true;
                });

            // Construir checkboxes de deducciones
            dedEntries
                .sort((a, b) => a[1].localeCompare(b[1], 'es-MX'))
                .forEach(([canonicalKey, label]) => {
                    const checkboxId = `ded-${canonicalKey}`;
                    const wrapper = document.createElement('label');
                    wrapper.className = 'checkbox-item';
                    wrapper.style.display = 'block';
                    wrapper.style.marginBottom = '4px';
                    wrapper.innerHTML = `
                        <input type="checkbox" id="${checkboxId}"
                               data-type="deducciones"
                               data-key="${canonicalKey}"
                               checked />
                        <span>${label}</span>
                    `;
                    dedDiv.appendChild(wrapper);
                    selectedConcepts.deducciones[canonicalKey] = true;
                });
        }

        // -------------------------------
        // Selección de empresa
        // -------------------------------
        companyCards.forEach(card => {
            card.addEventListener('click', () => {
                if (card.classList.contains('disabled')) return;

                companyCards.forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');

                selectedCompany = card.dataset.company;
                selectedCompanyName.textContent = selectedCompany;
                selectedCompanyDiv.style.display = 'block';

                if (selectedCompany === 'Fonamex') {
                    fonamexOptions.style.display = 'block';
                    const periodRadios = document.querySelectorAll('input[name="fonamex-period"]');
                    periodRadios.forEach(radio => {
                        radio.addEventListener('change', () => {
                            weekInput.style.display = radio.value === 'semanal' ? 'block' : 'none';
                        });
                    });
                } else {
                    fonamexOptions.style.display = 'none';
                }

                dropZone.classList.remove('disabled');
                addLog(`Empresa seleccionada: ${selectedCompany}`, 'success');
            });
        });

        // -------------------------------
        // Manejo de archivos
        // -------------------------------
        function handleFiles(files) {
            uploadedFiles = Array.from(files).filter(file => file.name.toLowerCase().endsWith('.xml'));

            if (uploadedFiles.length === 0) {
                fileInfo.style.display = 'none';
                addLog('No se seleccionaron archivos XML válidos.', 'error');
                return;
            }

            fileInfo.style.display = 'block';
            fileCount.textContent = uploadedFiles.length.toString();
            fileList.innerHTML = uploadedFiles.map(file => `<li>${file.name}</li>`).join('');

            if (!document.getElementById('process-bton')) {
                const processbton = document.createElement('button');
                processbton.className = 'bton bton-success bton-lg bton-block';
                processbton.innerHTML = '<i class="fas fa-play"></i> Iniciar Procesamiento';
                processbton.style.marginTop = '20px';
                processbton.id = 'process-bton';
                processbton.addEventListener('click', startProcessing);
                dropZone.parentNode.insertBefore(processbton, dropZone.nextSibling);
            }
        }

        xmlFilesInput.addEventListener('change', (e) => {
            handleFiles(e.target.files);
        });

        browsebton.addEventListener('click', () => xmlFilesInput.click());

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (dropZone.classList.contains('disabled')) return;
            handleFiles(e.dataTransfer.files);
        });

        // -------------------------------
        // Procesar archivos XML
        // -------------------------------
        async function startProcessing() {
            if (!selectedCompany || uploadedFiles.length === 0) {
                addLog('Por favor selecciona una empresa y archivos XML', 'error');
                return;
            }

            // 1) Validar que el XML corresponda a la empresa seleccionada
            const isValidCompany = await validateFirstXmlCompany();
            if (!isValidCompany) {
                addLog('Procesamiento detenido: la empresa seleccionada no coincide con la de los XML.', 'error');
                return;
            }

            // 2) Cargar catálogo JSON de conceptos de nómina
            await ensureNomCatalogLoaded();
            if (nomCatalog && nomCatalog[selectedCompany]) {
                companyConceptConfig = nomCatalog[selectedCompany];
                addLog(`Usando catálogo de conceptos configurado para: ${selectedCompany}`, 'info');
            } else {
                companyConceptConfig = null;
                addLog('No se encontró sección para la empresa seleccionada en nom.json. Se procesará sin catálogo dinámico.', 'warning');
            }

            // Reiniciar selección y uso de conceptos
            conceptUsage = { percepciones: {}, deducciones: {} };
            selectedConcepts = { percepciones: {}, deducciones: {} };

            processingSection.style.display = 'block';
            addLog('Iniciando procesamiento de archivos...', 'info');

            processingData.totalFiles = uploadedFiles.length;
            processingData.processed = 0;
            processingData.errors = 0;
            totalFiles.textContent = processingData.totalFiles;

            processedXMLData = [];
            finalData = [];
            errorDetails = [];
            employeeDetails = [];
            stateSummary = [];
            xmlDates = [];

            for (const file of uploadedFiles) {
                try {
                    addLog(`Procesando: ${file.name}`, 'info');

                    const content = await readFileAsText(file);
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(content, "text/xml");

                    const comprobante = xmlDoc.documentElement;
                    const fechaStr = comprobante.getAttribute('Fecha');
                    if (fechaStr) {
                        const fecha = new Date(fechaStr);
                        xmlDates.push(fecha);
                    }

                    const employeeData = processXML(xmlDoc);
                    processedXMLData.push(employeeData);

                    processingData.processed++;
                    processedFiles.textContent = processingData.processed;
                    addLog(`Procesado correctamente: ${file.name}`, 'success');
                } catch (error) {
                    processingData.errors++;
                    errorFiles.textContent = processingData.errors;
                    addLog(`Error procesando ${file.name}: ${error.message}`, 'error');

                    errorDetails.push({
                        fileName: file.name,
                        message: error.message
                    });
                }

                const progress = Math.floor((processingData.processed / processingData.totalFiles) * 100);
                progressFill.style.width = `${progress}%`;
                progressText.textContent = `${progress}%`;
                progressFill.querySelector('.progress-text').textContent = `${progress}%`;
            }

            combineEmployeeData();
            addTotalRow();

            // Construir checkboxes de conceptos dinámicos (según lo encontrado en los XML)
            buildConceptCheckboxes();

            stateSummary = generateStateSummary();
            renderStateSummary();

            processingSection.style.display = 'none';
            resultsSection.style.display = 'block';
            addLog('Procesamiento completado exitosamente!', 'success');

            if (errorDetails.length > 0) {
                errorCard.style.display = 'block';
            }
            if (employeeDetails.length > 0) {
                employeeCard.style.display = 'block';
            }
        }

        // -------------------------------
        // Helpers XML
        // -------------------------------
        function readFileAsText(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (event) => resolve(event.target.result);
                reader.onerror = (error) => reject(error);
                reader.readAsText(file);
            });
        }

        function findElementByNS(xmlDoc, namespace, tagName) {
            const elements = xmlDoc.getElementsByTagNameNS(namespace, tagName);
            return elements.length > 0 ? elements[0] : null;
        }

        function findChildElementByNS(parent, namespace, tagName) {
            const elements = parent.getElementsByTagNameNS(namespace, tagName);
            return elements.length > 0 ? elements[0] : null;
        }

        // -------------------------------
        // Validar que el XML corresponda a la empresa seleccionada
        // -------------------------------
        async function validateFirstXmlCompany() {
            if (!selectedCompany || uploadedFiles.length === 0) {
                return false;
            }

            const config = companyValidationConfig[selectedCompany];
            if (!config) {
                const msg = `No hay validación configurada para la empresa "${selectedCompany}". `
                          + `Configura su RFC en companyValidationConfig antes de procesar XML.`;
                addLog(msg, 'error');
                alert(msg);
                return false;
            }

            try {
                const file = uploadedFiles[0]; // Usamos el primer XML como referencia
                const content = await readFileAsText(file);
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(content, "text/xml");

                const emisor = findElementByNS(xmlDoc, ns.cfdi, 'Emisor');
                if (!emisor) {
                    addLog('No se encontró el nodo Emisor en el XML para validar la empresa.', 'error');
                    alert('No se pudo validar la empresa porque el XML no contiene Emisor. Revisa el archivo.');
                    return false;
                }

                const xmlRfc = (emisor.getAttribute('Rfc') || '').toUpperCase();
                const xmlName = (emisor.getAttribute('Nombre') || '').toUpperCase();

                const expectedRfc = (config.rfc || '').toUpperCase();

                if (!expectedRfc) {
                    const msg = `No se definió RFC esperado para "${selectedCompany}" en companyValidationConfig.`;
                    addLog(msg, 'error');
                    alert(msg);
                    return false;
                }

                if (xmlRfc !== expectedRfc) {
                    const msg =
                        `❌ La empresa seleccionada (${selectedCompany}) no coincide con la empresa del XML.\n\n` +
                        `RFC esperado: ${expectedRfc}\n` +
                        `RFC en XML: ${xmlRfc || 'N/D'}\n` +
                        `Nombre en XML: ${xmlName || 'N/D'}`;
                    addLog(msg, 'error');
                    alert(msg);
                    return false;
                }

                addLog('Validación de empresa superada: el XML corresponde a la empresa seleccionada.', 'success');
                return true;

            } catch (error) {
                addLog('Error al validar la empresa en el XML: ' + error.message, 'error');
                alert('Ocurrió un error al validar la empresa en el XML. Revisa el archivo o inténtalo de nuevo.');
                return false;
            }
        }


        // -------------------------------
        // Procesar un XML
        // -------------------------------
        function processXML(xmlDoc) {
            const uuidNode = findElementByNS(xmlDoc, ns.tfd, 'TimbreFiscalDigital');
            const uuid = uuidNode ? uuidNode.getAttribute('UUID') : "NO_ENCONTRADO";

            const comprobante = xmlDoc.documentElement;

            const emisor = findElementByNS(xmlDoc, ns.cfdi, 'Emisor');
            const receptor = findElementByNS(xmlDoc, ns.cfdi, 'Receptor');
            const nomina = findElementByNS(xmlDoc, ns.nom, 'Nomina');
            const receptorNom = findChildElementByNS(nomina, ns.nom, 'Receptor');

            const fecha = new Date(comprobante.getAttribute('Fecha')).toLocaleString('es-MX', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const rowData = {
                UUID: uuid,
                UUID2: null,
                NumEmpleado: receptorNom ? receptorNom.getAttribute('NumEmpleado') : '',
                Receptor: receptor ? receptor.getAttribute('Nombre') : '',
                RFC_REC: receptor ? receptor.getAttribute('Rfc') : '',
                Emisor: emisor ? emisor.getAttribute('Nombre') : '',
                Fecha: fecha,
                'Registro patronal': nomina ? findChildElementByNS(nomina, ns.nom, 'Emisor')?.getAttribute('RegistroPatronal') || '' : '',
                Curp: receptorNom ? receptorNom.getAttribute('Curp') : '',
                NumSeguridadSocial: receptorNom ? receptorNom.getAttribute('NumSeguridadSocial') : '',
                FechaInicioRelLaboral: receptorNom ? receptorNom.getAttribute('FechaInicioRelLaboral') : '',
                Departamento: receptorNom ? receptorNom.getAttribute('Departamento') : '',
                Puesto: receptorNom ? receptorNom.getAttribute('Puesto') : '',
                SalarioBaseCotApor: receptorNom ? parseFloat(receptorNom.getAttribute('SalarioBaseCotApor')) || 0 : 0,
                ClaveEntFed: receptorNom ? receptorNom.getAttribute('ClaveEntFed') : '',
                FechaPago: nomina ? nomina.getAttribute('FechaPago') : '',
                FechaInicialPago: nomina ? nomina.getAttribute('FechaInicialPago') : '',
                FechaFinalPago: nomina ? nomina.getAttribute('FechaFinalPago') : '',
                NumDiasPagados: nomina ? parseFloat(nomina.getAttribute('NumDiasPagados')) || 0 : 0,
                TotalPercepciones: nomina ? parseFloat(nomina.getAttribute('TotalPercepciones')) || 0 : 0,
                TotalDeducciones: nomina ? parseFloat(nomina.getAttribute('TotalDeducciones')) || 0 : 0,
                'SueldoPerGravado': 0,
                'DESPENSA MONEDERO ELECTRONICO': 0,
                'PREMIO DE PUNT Y ASIST Grav': 0,
                'ISPT': 0,
                'IMSS': 0,
                'SUBSIDIO PARA EL EMPLEO': 0,
                'CREDITO INFONAVIT': 0,
                'PRESTAMO PERSONAL': 0,
                'VACACIONES Grav': 0,
                'PRIMA VACACIONAL Ex': 0,
                'PRIMA VACACIONAL Grav': 0,
                'PRIMA DE ANTIGUEDAD GRA': 0,
                'GRATIFICACION UNICA Grav': 0,
                'DEUDAS DIVERSAS': 0,
                'PENSION ALIMENTICIA': 0,
                'AGUINALDO Ex': 0,
                'AGUINALDO Gra': 0
            };

            if (nomina) {
                const percepciones = findChildElementByNS(nomina, ns.nom, 'Percepciones');
                if (percepciones) {
                    const percepcionList = percepciones.getElementsByTagNameNS(ns.nom, 'Percepcion');
                    for (let i = 0; i < percepcionList.length; i++) {
                        const per = percepcionList[i];
                        const concepto = per.getAttribute('Concepto');
                        const importeGravado = parseFloat(per.getAttribute('ImporteGravado')) || 0;
                        const importeExento = parseFloat(per.getAttribute('ImporteExento')) || 0;

                        const clavePer = per.getAttribute('Clave');
                        const conceptInfo = findConceptInCatalog('PERCEPCIONES', clavePer, concepto);

                        if (conceptInfo) {
                            const { canonicalKey, config } = conceptInfo;
                            const hasTypes = config && typeof config === 'object' && config.tipos && Array.isArray(config.tipos);

                            if (hasTypes) {
                                // Expandir por cada tipo
                                config.tipos.forEach(tipo => {
                                    let suffix = '';
                                    let importeToAdd = 0;
                                    if (tipo === 'ImporteGravado') {
                                        suffix = '_Grav';
                                        importeToAdd = importeGravado;
                                    } else if (tipo === 'ImporteExento') {
                                        suffix = '_Ex';
                                        importeToAdd = importeExento;
                                    } else {
                                        // Para otros tipos (ej. SubsidioCausado) se suma el total
                                        suffix = '_' + tipo;
                                        importeToAdd = importeGravado + importeExento;
                                    }
                                    const expandedKey = canonicalKey + suffix;
                                    const displayName = getConceptDisplayName('PERCEPCIONES', canonicalKey, tipo);
                                    conceptUsage.percepciones[expandedKey] = displayName;
                                    rowData[expandedKey] = (rowData[expandedKey] || 0) + importeToAdd;
                                });
                            } else {
                                // Concepto simple: suma gravado + exento
                                const displayName = getConceptDisplayName('PERCEPCIONES', canonicalKey);
                                conceptUsage.percepciones[canonicalKey] = displayName;
                                const totalImporte = importeGravado + importeExento;
                                rowData[canonicalKey] = (rowData[canonicalKey] || 0) + totalImporte;
                            }
                        }

                        // El resto de los mapeos fijos (SUELDO, VACACIONES, etc.) puedes conservarlos si quieres,
                        // pero ya no serán necesarios porque el catálogo los cubre.
                        // Si decides conservarlos, ten cuidado con las duplicidades.
                        // Yo recomendaría eliminarlos y confiar solo en el catálogo dinámico.
                    }
                }

                // Deducciones
                const deducciones = findChildElementByNS(nomina, ns.nom, 'Deducciones');
                if (deducciones) {
                    const deduccionList = deducciones.getElementsByTagNameNS(ns.nom, 'Deduccion');
                    for (let i = 0; i < deduccionList.length; i++) {
                        const ded = deduccionList[i];
                        const concepto = ded.getAttribute('Concepto');
                        const importe = parseFloat(ded.getAttribute('Importe')) || 0;

                        // --- Mapeo dinámico contra catálogo JSON (DEDUCCIONES) ---
                        const claveDed = ded.getAttribute('Clave');
                        const canonicalDed = matchConceptFromCatalog('DEDUCCIONES', claveDed, concepto);
                        if (canonicalDed) {
                            const labelDed = getConceptDisplayName('DEDUCCIONES', canonicalDed);
                            conceptUsage.deducciones[canonicalDed] = labelDed;
                            rowData[canonicalDed] = (rowData[canonicalDed] || 0) + importe;
                        }

                        switch (concepto) {
                            case 'DESPENSA MONEDERO ELECTRONICO':
                                rowData['DESPENSA MONEDERO ELECTRONICO'] = importe;
                                break;
                            case 'ISPT':
                                rowData['ISPT'] = importe;
                                break;
                            case 'IMSS':
                                rowData['IMSS'] = importe;
                                break;
                            case 'CREDITO INFONAVIT':
                                rowData['CREDITO INFONAVIT'] = importe;
                                break;
                            case 'PRESTAMO PERSONAL':
                                rowData['PRESTAMO PERSONAL'] = importe;
                                break;
                            case 'DEUDAS DIVERSAS':
                                rowData['DEUDAS DIVERSAS'] = importe;
                                break;
                            case 'PENSION ALIMENTICIA':
                                rowData['PENSION ALIMENTICIA'] = importe;
                                break;
                        }
                    }
                }

                const otrosPagos = findChildElementByNS(nomina, ns.nom, 'OtrosPagos');
                if (otrosPagos) {
                    const otroPagoList = otrosPagos.getElementsByTagNameNS(ns.nom, 'OtroPago');
                    for (let i = 0; i < otroPagoList.length; i++) {
                        const otro = otroPagoList[i];
                        const concepto = otro.getAttribute('Concepto');
                        if (concepto === 'SUBSIDIO PRA EL EMPLEO') {
                            const subsidioNode = findChildElementByNS(otro, ns.nom, 'SubsidioAlEmpleo');
                            if (subsidioNode) {
                                const subsidio = parseFloat(subsidioNode.getAttribute('SubsidioCausado')) || 0;
                                rowData['SUBSIDIO PARA EL EMPLEO'] = subsidio;
                            }
                        }
                    }
                }
            }

            return rowData;
        }

        // -------------------------------
        // Combinar empleados con múltiples XML
        // -------------------------------
        function combineEmployeeData() {
            const groupedData = {};

            processedXMLData.forEach(data => {
                const empNum = data.NumEmpleado;
                if (!empNum) return;
                if (!groupedData[empNum]) groupedData[empNum] = [];
                groupedData[empNum].push(data);
            });

            // Lista de campos que NO deben sumarse (identificadores, texto, etc.)
            const nonNumericKeys = [
                'UUID', 'UUID2', 'NumEmpleado', 'Receptor', 'RFC_REC', 'Emisor',
                'Fecha', 'Registro patronal', 'Curp', 'NumSeguridadSocial',
                'FechaInicioRelLaboral', 'Departamento', 'Puesto', 'ClaveEntFed',
                'FechaPago', 'FechaInicialPago', 'FechaFinalPago'
            ];

            finalData = [];

            Object.values(groupedData).forEach(group => {
                if (group.length === 1) {
                    finalData.push(group[0]);
                } else {
                    const combined = { ...group[0] };
                    for (let i = 1; i < group.length; i++) {
                        const current = group[i];
                        for (const [key, value] of Object.entries(current)) {
                            if (nonNumericKeys.includes(key)) {
                                // Para UUID2, solo guardamos el UUID del segundo XML
                                if (key === 'UUID2') combined.UUID2 = value;
                                continue;
                            }
                            if (typeof value === 'number') {
                                combined[key] = (combined[key] || 0) + value;
                            }
                        }
                    }
                    finalData.push(combined);
                }
            });

            employeesProcessed.textContent = finalData.length.toString();
            if (finalData.length === 0) addLog('No se procesaron empleados.', 'warning');
        }

        // -------------------------------
        // Total general
        // -------------------------------
        function addTotalRow() {
            if (finalData.length === 0) return;

            const totalRow = finalData.reduce((acc, row) => {
                Object.keys(row).forEach(key => {
                    if (typeof row[key] === 'number' && key !== 'UUID' && key !== 'UUID2') {
                        acc[key] = (acc[key] || 0) + row[key];
                    }
                });
                return acc;
            }, {});

            totalRow.NumEmpleado = '';
            totalRow.Receptor = 'TOTAL';
            totalRow.NumDiasPagados = 'TOTAL';

            finalData.push(totalRow);
        }

        // -------------------------------
        // Resumen por estado (3%)
        // -------------------------------
        function generateStateSummary() {
            const dataRows = finalData.filter(row => row.NumDiasPagados !== 'TOTAL');
            const stateMap = {};

            dataRows.forEach(row => {
                const state = row.ClaveEntFed;
                if (!state) return;
                if (!stateMap[state]) {
                    stateMap[state] = 0;
                }
                stateMap[state] += row.TotalPercepciones || 0;
            });

            let totalThreePercent = 0;
            const summary = Object.entries(stateMap).map(([state, total]) => {
                const threePercent = total * 0.03;
                totalThreePercent += threePercent;
                return {
                    state,
                    total,
                    threePercent
                };
            });

            summary.push({
                state: 'TOTAL',
                total: Object.values(stateMap).reduce((sum, val) => sum + val, 0),
                threePercent: totalThreePercent
            });

            return summary;
        }

        function renderStateSummary() {
            let html = '';

            if (stateSummary.length === 0) {
                html = `<tr><td colspan="3" style="text-align: center;">No hay datos disponibles</td></tr>`;
            } else {
                stateSummary.forEach((summary, index) => {
                    const isTotal = summary.state === 'TOTAL';
                    html += `
                        <tr${isTotal ? ' class="total-row"' : ''}>
                            <td>${summary.state}</td>
                            <td>${summary.total.toFixed(2)}</td>
                            <td>${summary.threePercent.toFixed(2)}</td>
                        </tr>
                    `;
                });
            }

            summaryBody.innerHTML = html;
        }

        function generateFileName() {
            // Si por alguna razón no hay fechas acumuladas, usa fecha actual + empresa
            if (xmlDates.length === 0) {
                return `${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_xml_${selectedCompany}.xlsx`;
            }

            // Fecha promedio de los XML
            const avgTimestamp = xmlDates.reduce((sum, date) => sum + date.getTime(), 0) / xmlDates.length;
            const avgDate = new Date(avgTimestamp);
            const day = avgDate.getDate();
            const month = avgDate.getMonth() + 1;
            const year = avgDate.getFullYear();

            // Nombres de meses en español
            const monthNames = [
                'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
                'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
            ];

            let periodName = '';

            // Para Fonamex, verificar si es semanal o quincenal
            if (selectedCompany === 'Fonamex') {
                const periodType = document.querySelector('input[name="fonamex-period"]:checked')?.value;

                if (periodType === 'semanal') {
                    const weekNum = document.getElementById('week-number')?.value || '';
                    // Para semanal: sólo "SEMANA X AÑO"
                    return `SEMANA ${weekNum} ${year}.xlsx`;
                } else {
                    // Quincena para Fonamex
                    if (day <= 16) {
                        periodName = '1ER QUINCENA';
                    } else {
                        periodName = '2DA QUINCENA';
                    }
                }
            } else {
                // Para otras empresas, siempre usar quincena
                if (day <= 16) {
                    periodName = '1ER QUINCENA';
                } else {
                    periodName = '2DA QUINCENA';
                }
            }

            // Default: quincenas sí llevan empresa y mes
            return `${periodName} ${monthNames[month - 1]} ${year} - ${selectedCompany}.xlsx`;
        }


        // -------------------------------
        // Modales
        // -------------------------------
        function showErrorModal() {
            if (errorDetails.length === 0) {
                errorList.innerHTML = '<tr><td colspan="2" style="text-align: center;">No hay errores</td></tr>';
            } else {
                errorList.innerHTML = errorDetails.map(error => `
                    <tr>
                        <td>${error.fileName}</td>
                        <td>${error.message}</td>
                    </tr>
                `).join('');
            }
            errorModal.style.display = 'flex';
        }

        function showEmployeeModal() {
            if (employeeDetails.length === 0) {
                employeeList.innerHTML = '<tr><td colspan="3" style="text-align: center;">No hay empleados</td></tr>';
            } else {
                employeeList.innerHTML = employeeDetails.map(emp => `
                    <tr>
                        <td>${emp.num}</td>
                        <td>${emp.name}</td>
                        <td>${emp.dept}</td>
                    </tr>
                `).join('');
            }
            employeeModal.style.display = 'flex';
        }

        closeErrorModal.addEventListener('click', () => {
            errorModal.style.display = 'none';
        });

        closeEmployeeModal.addEventListener('click', () => {
            employeeModal.style.display = 'none';
        });

        // -------------------------------
        // Descargar Excel (ExcelJS)
        // -------------------------------
        downloadbton.addEventListener('click', async () => {
            try {
                addLog('Generando reporte Excel con formato...', 'info');

                const workbook = new ExcelJS.Workbook();
                const worksheet = workbook.addWorksheet('Nomina');

                const baseColumns = [
                    { header: 'UUID', key: 'UUID', width: 36 },
                    { header: 'UUID2', key: 'UUID2', width: 20 },
                    { header: 'NumEmpleado', key: 'NumEmpleado', width: 12 },
                    { header: 'Receptor', key: 'Receptor', width: 30 },
                    { header: 'RFC_REC', key: 'RFC_REC', width: 15 },
                    { header: 'Emisor', key: 'Emisor', width: 20 },
                    { header: 'Fecha', key: 'Fecha', width: 20 },
                    { header: 'Registro patronal', key: 'Registro patronal', width: 18 },
                    { header: 'Curp', key: 'Curp', width: 18 },
                    { header: 'NumSeguridadSocial', key: 'NumSeguridadSocial', width: 20 },
                    { header: 'FechaInicioRelLaboral', key: 'FechaInicioRelLaboral', width: 20 },
                    { header: 'Departamento', key: 'Departamento', width: 20 },
                    { header: 'Puesto', key: 'Puesto', width: 25 },
                    { header: 'SalarioBaseCotApor', key: 'SalarioBaseCotApor', width: 20 },
                    { header: 'ClaveEntFed', key: 'ClaveEntFed', width: 12 },
                    { header: 'FechaPago', key: 'FechaPago', width: 12 },
                    { header: 'FechaInicialPago', key: 'FechaInicialPago', width: 18 },
                    { header: 'FechaFinalPago', key: 'FechaFinalPago', width: 18 },
                    { header: 'NumDiasPagados', key: 'NumDiasPagados', width: 15 },
                    { header: 'TotalPercepciones', key: 'TotalPercepciones', width: 20 },
                    { header: 'TotalDeducciones', key: 'TotalDeducciones', width: 18 },
                    { header: 'SueldoPerGravado', key: 'SueldoPerGravado', width: 18 },
                ];

                // Columnas dinámicas generadas a partir del catálogo JSON (conceptos seleccionados)
                const dynamicColumns = [];

                if (companyConceptConfig) {
                    const perEntries = Object.entries(conceptUsage.percepciones || {});
                    const dedEntries = Object.entries(conceptUsage.deducciones || {});

                    perEntries.forEach(([canonicalKey, label]) => {
                        if (selectedConcepts.percepciones[canonicalKey] !== false) {
                            dynamicColumns.push({
                                header: label || canonicalKey,
                                key: canonicalKey,
                                width: 18
                            });
                        }
                    });

                    dedEntries.forEach(([canonicalKey, label]) => {
                        if (selectedConcepts.deducciones[canonicalKey] !== false) {
                            dynamicColumns.push({
                                header: label || canonicalKey,
                                key: canonicalKey,
                                width: 18
                            });
                        }
                    });
                }

                worksheet.columns = [...baseColumns, ...dynamicColumns];

                const headerRow = worksheet.getRow(1);
                headerRow.eachCell((cell) => {
                    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000080' } };
                });

                finalData.forEach(row => {
                    worksheet.addRow(row);
                });

                const lastRowNumber = worksheet.lastRow.number;
                const totalRow = worksheet.getRow(lastRowNumber);
                totalRow.font = { bold: true };

                worksheet.columns.forEach((column, index) => {
                    if (index >= 10) {
                        worksheet.getColumn(index + 1).numFmt = '#,##0.00';
                    }
                });

                const startSummaryRow = worksheet.lastRow.number + 2;
                worksheet.getCell(`A${startSummaryRow}`).value = 'Resumen por Estado (3%)';
                worksheet.getCell(`A${startSummaryRow}`).font = { bold: true };

                const summaryTitleRow = worksheet.getRow(startSummaryRow);
                summaryTitleRow.getCell(1).value = 'Estado';
                summaryTitleRow.getCell(2).value = 'Total Percepciones';
                summaryTitleRow.getCell(3).value = '3%';
                summaryTitleRow.eachCell(cell => {
                    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000080' } };
                });

                stateSummary.forEach((summary, index) => {
                    const rowNumber = startSummaryRow + 1 + index;
                    const row = worksheet.getRow(rowNumber);
                    const isTotal = summary.state === 'TOTAL';

                    row.getCell(1).value = summary.state;
                    row.getCell(2).value = summary.total;
                    row.getCell(3).value = summary.threePercent;

                    if (isTotal) {
                        row.font = { bold: true };
                    }
                });

                for (let i = summaryTitleRow.number + 2; i <= worksheet.rowCount; i++) {
                    const row = worksheet.getRow(i);
                    if (row.getCell(2).value) {
                        row.getCell(2).numFmt = '#,##0.00';
                    }
                    if (row.getCell(3).value) {
                        row.getCell(3).numFmt = '#,##0.00';
                    }
                }

                const buffer = await workbook.xlsx.writeBuffer();
                const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;

                // ⬇️ reutilizamos la lógica de la versión anterior
                a.download = generateFileName();

                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);


                addLog('Reporte Excel generado y descargado.', 'success');
            } catch (error) {
                addLog('Error al generar el archivo Excel: ' + error.message, 'error');
            }
        });

        // -------------------------------
        // Nuevo proceso
        // -------------------------------
        newProcessbton.addEventListener('click', () => {
            resetUI();
            uploadedFiles = [];
            processedXMLData = [];
            finalData = [];
            errorDetails = [];
            employeeDetails = [];
            stateSummary = [];
            xmlDates = [];
            conceptUsage = { percepciones: {}, deducciones: {} };
            selectedConcepts = { percepciones: {}, deducciones: {} };
            addLog('Listo para un nuevo procesamiento.', 'info');
        });

        // Event listeners para modales de errores y empleados
        errorCard.addEventListener('click', showErrorModal);
        employeeCard.addEventListener('click', showEmployeeModal);
        closeErrorModal.addEventListener('click', () => errorModal.style.display = 'none');
        closeEmployeeModal.addEventListener('click', () => employeeModal.style.display = 'none');

        // Cerrar modales al hacer clic fuera de ellos
        window.addEventListener('click', (e) => {
            if (e.target === errorModal) errorModal.style.display = 'none';
            if (e.target === employeeModal) employeeModal.style.display = 'none';
        });

        // Inicialización
        resetUI();
        addLog('Selecciona una empresa para comenzar.', 'info');