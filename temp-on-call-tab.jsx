        {/* Tab Content - All Departments On-Call */}
        {activeTab === 'all-on-call' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">כוננים נוכחיים בכל המכלולים</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    🕐 עודכן: {new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} | 📅 {DAYS[new Date().getDay()]}
                  </p>
                </div>
                <button
                  onClick={loadCurrentOnCall}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium flex items-center gap-2"
                >
                  🔄 רענן
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {allDepartments.map((department) => {
                  const isMyDepartment = department.id === user.department_id;
                  const departmentOnCall = currentOnCall.filter(d => d.department_id === department.id);
                  
                  return (
                    <div 
                      key={department.id} 
                      className={`border-2 rounded-xl p-5 transition-all ${
                        isMyDepartment 
                          ? 'border-purple-500 bg-purple-50 shadow-lg' 
                          : 'border-gray-200 bg-white hover:border-purple-300 hover:shadow-md'
                      }`}
                    >
                      {/* Department Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="text-2xl">🏢</div>
                          <h3 className="font-bold text-lg text-gray-900">{department.name}</h3>
                        </div>
                        {isMyDepartment && (
                          <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded-full font-bold">
                            המכלול שלי
                          </span>
                        )}
                      </div>

                      {/* On-Call Personnel */}
                      <div className="space-y-3">
                        {departmentOnCall.length > 0 ? (
                          departmentOnCall.map((duty) => (
                            <div 
                              key={duty.id} 
                              className="bg-green-50 border-2 border-green-200 rounded-lg p-3"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xl">👤</span>
                                    <span className="font-bold text-gray-900">{duty.contact?.full_name || 'לא ידוע'}</span>
                                  </div>
                                  
                                  <div className="text-sm text-gray-700 space-y-1">
                                    {duty.contact?.role && (
                                      <div className="flex items-center gap-1">
                                        <span className="text-xs">💼</span>
                                        <span>{duty.contact.role}</span>
                                      </div>
                                    )}
                                    
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs">⏰</span>
                                      <span className="font-semibold">
                                        {getShiftLabel(duty.start_hour, duty.end_hour, duty.notes)}
                                      </span>
                                      <span className="text-xs text-gray-600">
                                        ({duty.start_hour}:00 - {duty.end_hour}:00)
                                      </span>
                                    </div>
                                    
                                    {duty.contact?.phone && (
                                      <a 
                                        href={`tel:${duty.contact.phone}`}
                                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
                                      >
                                        <span className="text-xs">📞</span>
                                        <span>{duty.contact.phone}</span>
                                      </a>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="text-2xl">
                                  {duty.notes?.includes('[לן]') ? '🛏️' : '🚨'}
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4 text-center">
                            <div className="text-3xl mb-2">😴</div>
                            <p className="text-sm text-gray-600 font-medium">אין כוננים כרגע</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {allDepartments.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🏢</div>
                  <p className="text-gray-600 mb-4">אין מכלולים במערכת</p>
                </div>
              )}
            </div>
          </div>
        )}
